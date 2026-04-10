mod calc;

use calc::*;
use tauri::command;

#[command]
fn compute_product(ctx: CalcContext, product: Product) -> ProductCalc {
    calc_product(&ctx, &product)
}

#[command]
fn reverse_profit(ctx: CalcContext, product: Product, target_profit: f64) -> Option<f64> {
    reverse_supply_from_profit(&ctx, &product, target_profit)
}

#[command]
fn reverse_margin(ctx: CalcContext, product: Product, target_margin: f64) -> Option<f64> {
    reverse_supply_from_margin(&ctx, &product, target_margin)
}

#[command]
fn reverse_comp_margin(
    ctx: CalcContext,
    product: Product,
    target_comp_margin: f64,
) -> Option<f64> {
    reverse_retail_from_comp_margin(&ctx, &product, target_comp_margin)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            compute_product,
            reverse_profit,
            reverse_margin,
            reverse_comp_margin,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
