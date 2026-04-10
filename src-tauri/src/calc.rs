use serde::{Deserialize, Serialize};

/// 费用类型
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FeeType {
    PerUnit,
    LumpSum,
    Percentage,
}

/// 费用项
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Fee {
    pub id: u64,
    pub name: String,
    pub amount: f64,
    #[serde(rename = "type")]
    pub fee_type: FeeType,
}

/// 商品数据
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Product {
    pub id: u64,
    pub name: String,
    pub cost_price: f64,
    pub supply_price: f64,
    pub quantity: f64,
    pub retail_price: f64,
    pub fees: Vec<Fee>,
}

/// 计税模式
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaxMode {
    Exclusive,
    Inclusive,
}

/// 计算引擎的全局参数
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CalcContext {
    pub tax_mode: TaxMode,
    pub tax_rate: f64,
}

/// 商品计算结果
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProductCalc {
    pub fee_per_unit: f64,
    pub tax_per_unit: f64,
    pub profit_per_unit: f64,
    pub margin: f64,
    pub front_gp: f64,
    pub back_gp: f64,
    pub comp_gp: f64,
    pub comp_margin: f64,
    pub total_cost: f64,
    pub total_supply: f64,
    pub total_fees: f64,
    pub total_tax: f64,
    pub total_profit: f64,
}

/// 费用分解
struct FeeDecomp {
    fixed: f64,
    lump: f64,
    pct_rate: f64,
}

fn decomp_fees(fees: &[Fee]) -> FeeDecomp {
    let mut fixed = 0.0;
    let mut lump = 0.0;
    let mut pct_rate = 0.0;
    for f in fees {
        match f.fee_type {
            FeeType::PerUnit => fixed += f.amount,
            FeeType::LumpSum => lump += f.amount,
            FeeType::Percentage => pct_rate += f.amount,
        }
    }
    FeeDecomp { fixed, lump, pct_rate }
}

/// 计算单个商品的所有指标
pub fn calc_product(ctx: &CalcContext, p: &Product) -> ProductCalc {
    let r = ctx.tax_rate / 100.0;
    let q = if p.quantity > 0.0 { p.quantity } else { 0.0 };
    let c = p.cost_price;
    let s = p.supply_price;

    let fd = decomp_fees(&p.fees);
    let alloc_lump = if q > 0.0 { fd.lump / q } else { 0.0 };
    let fee_per_unit = fd.fixed + alloc_lump + s * fd.pct_rate / 100.0;

    let (tax_per_unit, profit_per_unit) = match ctx.tax_mode {
        TaxMode::Exclusive => {
            let tax = s * r;
            let profit = s - c - fee_per_unit - tax;
            (tax, profit)
        }
        TaxMode::Inclusive => {
            let s_excl = if r > -1.0 { s / (1.0 + r) } else { s };
            let tax = s - s_excl;
            let profit = s_excl - c - fee_per_unit;
            (tax, profit)
        }
    };

    let margin = if s != 0.0 { profit_per_unit / s * 100.0 } else { 0.0 };

    let front_gp = p.retail_price - s;
    let back_gp = fee_per_unit;
    let comp_gp = front_gp + back_gp;
    let comp_margin = if p.retail_price != 0.0 {
        comp_gp / p.retail_price * 100.0
    } else {
        0.0
    };

    ProductCalc {
        fee_per_unit,
        tax_per_unit,
        profit_per_unit,
        margin,
        front_gp,
        back_gp,
        comp_gp,
        comp_margin,
        total_cost: c * q,
        total_supply: s * q,
        total_fees: fee_per_unit * q,
        total_tax: tax_per_unit * q,
        total_profit: profit_per_unit * q,
    }
}

/// 从目标利润反推供价
pub fn reverse_supply_from_profit(ctx: &CalcContext, p: &Product, target_profit: f64) -> Option<f64> {
    let r = ctx.tax_rate / 100.0;
    let q = if p.quantity > 0.0 { p.quantity } else { 1.0 };
    let c = p.cost_price;
    let fd = decomp_fees(&p.fees);

    match ctx.tax_mode {
        TaxMode::Exclusive => {
            let denom = 1.0 - fd.pct_rate / 100.0 - r;
            if denom > 1e-10 {
                Some((target_profit + c + fd.fixed + fd.lump / q) / denom)
            } else {
                None
            }
        }
        TaxMode::Inclusive => {
            let a = 1.0 / (1.0 + r) - fd.pct_rate / 100.0;
            if a > 1e-10 {
                Some((target_profit + c + fd.fixed + fd.lump / q) / a)
            } else {
                None
            }
        }
    }
}

/// 从目标利润率反推供价
pub fn reverse_supply_from_margin(ctx: &CalcContext, p: &Product, target_margin: f64) -> Option<f64> {
    let r = ctx.tax_rate / 100.0;
    let q = if p.quantity > 0.0 { p.quantity } else { 1.0 };
    let c = p.cost_price;
    let fd = decomp_fees(&p.fees);

    match ctx.tax_mode {
        TaxMode::Exclusive => {
            let denom = 1.0 - fd.pct_rate / 100.0 - r - target_margin / 100.0;
            if denom > 1e-10 {
                Some((c + fd.fixed + fd.lump / q) / denom)
            } else {
                None
            }
        }
        TaxMode::Inclusive => {
            let a = 1.0 / (1.0 + r) - fd.pct_rate / 100.0;
            let denom = a - target_margin / 100.0;
            if denom > 1e-10 {
                Some((c + fd.fixed + fd.lump / q) / denom)
            } else {
                None
            }
        }
    }
}

/// 从目标综合利润率反推零售价
pub fn reverse_retail_from_comp_margin(
    ctx: &CalcContext,
    p: &Product,
    target_comp_margin: f64,
) -> Option<f64> {
    let calc = calc_product(ctx, p);
    let denom = 1.0 - target_comp_margin / 100.0;
    if denom.abs() > 1e-10 {
        let retail = (p.supply_price - calc.fee_per_unit) / denom;
        if retail > 0.0 {
            Some(retail)
        } else {
            None
        }
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exclusive_mode() {
        let ctx = CalcContext {
            tax_mode: TaxMode::Exclusive,
            tax_rate: 13.0,
        };
        let p = Product {
            id: 1,
            name: "测试".into(),
            cost_price: 50.0,
            supply_price: 100.0,
            quantity: 100.0,
            retail_price: 150.0,
            fees: vec![
                Fee { id: 1, name: "上架费".into(), amount: 5000.0, fee_type: FeeType::LumpSum },
                Fee { id: 2, name: "促销费".into(), amount: 2.0, fee_type: FeeType::PerUnit },
                Fee { id: 3, name: "返利".into(), amount: 3.0, fee_type: FeeType::Percentage },
            ],
        };

        let calc = calc_product(&ctx, &p);

        // fee_per_unit = 2.0 + 5000/100 + 100*3/100 = 2 + 50 + 3 = 55
        assert!((calc.fee_per_unit - 55.0).abs() < 0.01);
        // tax = 100 * 13% = 13
        assert!((calc.tax_per_unit - 13.0).abs() < 0.01);
        // profit = 100 - 50 - 55 - 13 = -18
        assert!((calc.profit_per_unit - (-18.0)).abs() < 0.01);
    }

    #[test]
    fn test_reverse_from_profit() {
        let ctx = CalcContext {
            tax_mode: TaxMode::Exclusive,
            tax_rate: 13.0,
        };
        let p = Product {
            id: 1,
            name: "测试".into(),
            cost_price: 50.0,
            supply_price: 0.0,
            quantity: 100.0,
            retail_price: 0.0,
            fees: vec![
                Fee { id: 1, name: "上架费".into(), amount: 5000.0, fee_type: FeeType::LumpSum },
                Fee { id: 2, name: "促销费".into(), amount: 2.0, fee_type: FeeType::PerUnit },
            ],
        };

        let target = 20.0;
        let new_supply = reverse_supply_from_profit(&ctx, &p, target).unwrap();

        let mut p2 = p.clone();
        p2.supply_price = new_supply;
        let calc = calc_product(&ctx, &p2);

        assert!((calc.profit_per_unit - target).abs() < 0.01);
    }

    #[test]
    fn test_inclusive_mode() {
        let ctx = CalcContext {
            tax_mode: TaxMode::Inclusive,
            tax_rate: 13.0,
        };
        let p = Product {
            id: 1,
            name: "测试".into(),
            cost_price: 50.0,
            supply_price: 113.0, // 含税价
            quantity: 1.0,
            retail_price: 150.0,
            fees: vec![],
        };

        let calc = calc_product(&ctx, &p);

        // 不含税 = 113/1.13 = 100
        // 税额 = 13
        assert!((calc.tax_per_unit - 13.0).abs() < 0.01);
        // 利润 = 100 - 50 = 50
        assert!((calc.profit_per_unit - 50.0).abs() < 0.01);
    }
}
