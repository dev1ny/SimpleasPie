(function () {
    'use strict';

    // ===== Helpers =====
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);
    const fmt = (n) => (typeof n === 'number' && isFinite(n) ? n.toFixed(2) : '0.00');
    const esc = (s) => String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');

    // ===== State =====
    const state = { taxMode: 'exclusive', taxRate: 13, products: [], _nid: 1 };
    function nid() { return state._nid++; }

    function createProduct(name) {
        return {
            id: nid(), name: name || ('商品' + String.fromCharCode(65 + state.products.length)),
            costPrice: 0, supplyPrice: 0, quantity: 1, retailPrice: 0,
            feesCollapsed: false, collapsed: false,
            fees: [
                { id: nid(), name: '上架费', amount: 0, type: 'lump_sum' },
                { id: nid(), name: '促销活动费', amount: 0, type: 'per_unit' },
                { id: nid(), name: '年度返利', amount: 0, type: 'percentage' },
            ],
        };
    }
    function findP(id) { return state.products.find(p => p.id === id); }
    function findF(p, fid) { return p.fees.find(f => f.id === fid); }

    // ===== Tauri IPC =====
    const invoke = window.__TAURI__ ? window.__TAURI__.core.invoke : null;

    // ===== Calculation Engine (JS mirror of Rust) =====
    function decompFees(fees) {
        let fixed = 0, lump = 0, pct = 0;
        for (const f of fees) {
            if (f.type === 'per_unit') fixed += f.amount || 0;
            else if (f.type === 'lump_sum') lump += f.amount || 0;
            else if (f.type === 'percentage') pct += f.amount || 0;
        }
        return { fixed, lump, pct };
    }

    function calcProduct(p) {
        const R = state.taxRate / 100;
        const Q = p.quantity || 0;
        const C = p.costPrice;
        const S = p.supplyPrice;
        const fd = decompFees(p.fees);
        const allocLump = Q > 0 ? fd.lump / Q : 0;
        const feePU = fd.fixed + allocLump + S * fd.pct / 100;

        let taxPU, profitPU;
        if (state.taxMode === 'exclusive') {
            taxPU = S * R;
            profitPU = S - C - feePU - taxPU;
        } else {
            const sExcl = R > -1 ? S / (1 + R) : S;
            taxPU = S - sExcl;
            profitPU = sExcl - C - feePU;
        }
        const margin = S !== 0 ? profitPU / S * 100 : 0;
        const frontGP = p.retailPrice - S;
        const backGP = feePU;
        const compGP = frontGP + backGP;
        const compMargin = p.retailPrice !== 0 ? compGP / p.retailPrice * 100 : 0;

        return { feePU, taxPU, profitPU, margin, frontGP, backGP, compGP, compMargin,
            totalCost: C * Q, totalSupply: S * Q, totalFees: feePU * Q, totalTax: taxPU * Q, totalProfit: profitPU * Q };
    }

    function calcSummary() {
        const s = { totalCost: 0, totalSupply: 0, totalFees: 0, totalTax: 0, totalProfit: 0, totalFrontGP: 0, totalBackGP: 0, totalCompGP: 0, totalRetail: 0 };
        for (const p of state.products) {
            const c = calcProduct(p);
            const q = p.quantity || 0;
            s.totalCost += c.totalCost; s.totalSupply += c.totalSupply;
            s.totalFees += c.totalFees; s.totalTax += c.totalTax; s.totalProfit += c.totalProfit;
            s.totalFrontGP += c.frontGP * q; s.totalBackGP += c.backGP * q;
            s.totalCompGP += c.compGP * q; s.totalRetail += p.retailPrice * q;
        }
        s.totalMargin = s.totalSupply !== 0 ? s.totalProfit / s.totalSupply * 100 : 0;
        s.totalCompMargin = s.totalRetail !== 0 ? s.totalCompGP / s.totalRetail * 100 : 0;
        return s;
    }

    // ===== Reverse Calculations =====
    function revSupplyFromProfit(p, target) {
        const R = state.taxRate / 100;
        const Q = p.quantity || 1;
        const C = p.costPrice;
        const fd = decompFees(p.fees);
        if (state.taxMode === 'exclusive') {
            const d = 1 - fd.pct / 100 - R;
            return d > 1e-10 ? (target + C + fd.fixed + fd.lump / Q) / d : null;
        } else {
            const a = 1 / (1 + R) - fd.pct / 100;
            return a > 1e-10 ? (target + C + fd.fixed + fd.lump / Q) / a : null;
        }
    }

    function revSupplyFromMargin(p, targetM) {
        const R = state.taxRate / 100;
        const Q = p.quantity || 1;
        const C = p.costPrice;
        const fd = decompFees(p.fees);
        if (state.taxMode === 'exclusive') {
            const d = 1 - fd.pct / 100 - R - targetM / 100;
            return d > 1e-10 ? (C + fd.fixed + fd.lump / Q) / d : null;
        } else {
            const a = 1 / (1 + R) - fd.pct / 100;
            const d = a - targetM / 100;
            return d > 1e-10 ? (C + fd.fixed + fd.lump / Q) / d : null;
        }
    }

    function revRetailFromCompMargin(p, targetCM) {
        const calc = calcProduct(p);
        const d = 1 - targetCM / 100;
        if (Math.abs(d) > 1e-10) {
            const r = (p.supplyPrice - calc.feePU) / d;
            return r > 0 ? r : null;
        }
        return null;
    }

    // ===== DOM Helpers =====
    function getCard(pid) { return document.querySelector('[data-pid="' + pid + '"]'); }
    function setField(pid, field, val) {
        const card = getCard(pid);
        if (!card) return;
        const el = card.querySelector('[data-field="' + field + '"]');
        if (el && document.activeElement !== el) el.value = fmt(val);
    }
    function setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = fmt(val);
    }
    function setClass(el, positive) {
        if (!el) return;
        el.classList.remove('positive', 'negative');
        el.classList.add(positive >= 0 ? 'positive' : 'negative');
    }

    // ===== Render Product Card =====
    function feeUnitLabel(type) {
        return type === 'per_unit' ? '¥/件' : type === 'lump_sum' ? '¥' : '%';
    }
    function feeTypeOption(val, sel) {
        const opts = [['per_unit', '按件'], ['lump_sum', '按总额'], ['percentage', '按百分比']];
        return opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === sel ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
    }

    function renderFeeRow(pid, fee) {
        return '<div class="fee-row" data-fid="' + fee.id + '">'
            + '<input type="text" class="fee-name-input" value="' + esc(fee.name) + '" data-ffield="name" placeholder="费用名称">'
            + '<div class="fee-amount-wrap"><input type="number" class="fee-amount-input" value="' + fmt(fee.amount) + '" data-ffield="amount" step="0.01" placeholder="0.00"><span class="fee-unit">' + feeUnitLabel(fee.type) + '</span></div>'
            + '<select class="fee-type-select" data-ffield="type">' + feeTypeOption(fee.type, fee.type) + '</select>'
            + '<button class="btn-remove-fee" data-action="remove-fee" title="删除">&#10005;</button>'
            + '</div>';
    }

    function renderProduct(p) {
        const calc = calcProduct(p);
        const feeRows = p.fees.map(function (f) { return renderFeeRow(p.id, f); }).join('');
        return '<div class="product-card' + (p.collapsed ? ' collapsed' : '') + '" data-pid="' + p.id + '">'
            + '<div class="card-header">'
            + '<input type="text" class="product-name-input" value="' + esc(p.name) + '" data-field="name">'
            + '<div class="card-actions">'
            + '<button class="btn-icon btn-toggle-card" data-action="toggle-card" title="收起/展开">' + (p.collapsed ? '&#9654;' : '&#9660;') + '</button>'
            + '<button class="btn-icon btn-remove-card" data-action="remove-card" title="删除">&#10005;</button>'
            + '</div></div>'
            + '<div class="card-body">'
            // 基础价格行
            + '<div class="field-row three-col">'
            + '<div class="field"><label>进价（成本价）</label><div class="input-wrap"><input type="number" step="0.01" value="' + fmt(p.costPrice) + '" data-field="costPrice" placeholder="0.00"><span class="unit">¥/件</span></div></div>'
            + '<div class="field"><label>供价（我方售价）</label><div class="input-wrap"><input type="number" step="0.01" value="' + fmt(p.supplyPrice) + '" data-field="supplyPrice" placeholder="0.00"><span class="unit">¥/件</span></div></div>'
            + '<div class="field"><label>数量</label><div class="input-wrap"><input type="number" step="1" value="' + p.quantity + '" data-field="quantity" placeholder="0"><span class="unit">件</span></div></div>'
            + '</div>'
            // 费用区
            + '<div class="fees-section">'
            + '<div class="fees-sub-header"><span class="fees-sub-title">费用明细</span><button class="btn-toggle-fees" data-action="toggle-fees">' + (p.feesCollapsed ? '展开' : '收起') + '</button></div>'
            + '<div class="fees-list' + (p.feesCollapsed ? ' hidden' : '') + '">' + feeRows + '<button class="btn-add-fee" data-action="add-fee">+ 添加费用</button></div>'
            + '<div class="fee-total-row"><span class="fee-total-label">费用合计</span><div class="fee-total-right"><span class="fee-total-value">' + fmt(calc.feePU) + '</span><span class="fee-total-unit">¥/件</span></div></div>'
            + '</div>'
            // 税
            + '<div class="field-row">'
            + '<div class="field"><label>税率</label><div class="input-wrap"><input type="number" step="0.01" value="' + fmt(state.taxRate) + '" data-field="taxRate" readonly class="readonly-input"><span class="unit">%</span></div></div>'
            + '<div class="field"><label>税额</label><div class="input-wrap"><input type="number" step="0.01" value="' + fmt(calc.taxPU) + '" data-field="taxAmount" placeholder="0.00"><span class="unit">¥/件</span></div></div>'
            + '</div>'
            // 我方利润
            + '<div class="result-box' + (calc.profitPU >= 0 ? ' positive' : ' negative') + '">'
            + '<div class="field"><label>利润金额</label><div class="input-wrap"><input type="number" step="0.01" value="' + fmt(calc.profitPU) + '" data-field="profit" placeholder="0.00"><span class="unit">¥/件</span></div></div>'
            + '<div class="field"><label>利润率</label><div class="input-wrap"><input type="number" step="0.01" value="' + fmt(calc.margin) + '" data-field="margin" placeholder="0.00"><span class="unit">%</span></div></div>'
            + '</div>'
            // 对方区
            + '<div class="partner-divider"><span>对方利润分析</span></div>'
            + '<div class="field-row">'
            + '<div class="field"><label>零售价（面向消费者）</label><div class="input-wrap"><input type="number" step="0.01" value="' + fmt(p.retailPrice) + '" data-field="retailPrice" placeholder="0.00"><span class="unit">¥/件</span></div></div>'
            + '</div>'
            + '<div class="result-box partner-result' + (calc.compGP >= 0 ? ' positive' : ' negative') + '">'
            + '<div class="field"><label>前台毛利</label><div class="input-wrap"><input type="number" step="0.01" value="' + fmt(calc.frontGP) + '" data-field="frontGP" placeholder="0.00"><span class="unit">¥</span></div></div>'
            + '<div class="field"><label>后台毛利（我方费用）</label><div class="input-wrap"><input type="text" value="' + fmt(calc.backGP) + '" data-field="backGP" readonly class="readonly-input"><span class="unit">¥</span></div></div>'
            + '<div class="field"><label>综合毛利</label><div class="input-wrap"><input type="number" step="0.01" value="' + fmt(calc.compGP) + '" data-field="compGP" placeholder="0.00"><span class="unit">¥</span></div></div>'
            + '<div class="field"><label>综合利润率</label><div class="input-wrap"><input type="number" step="0.01" value="' + fmt(calc.compMargin) + '" data-field="compMargin" placeholder="0.00"><span class="unit">%</span></div></div>'
            + '</div>'
            + '</div></div>';
    }

    // ===== Update Display =====
    function updateProduct(pid, src) {
        const p = findP(pid); if (!p) return;
        const card = getCard(pid); if (!card) return;
        const c = calcProduct(p);

        // Fee total
        const ftv = card.querySelector('.fee-total-value');
        if (ftv) ftv.textContent = fmt(c.feePU);

        // Tax rate display
        const trInput = card.querySelector('[data-field="taxRate"]');
        if (trInput && document.activeElement !== trInput) trInput.value = fmt(state.taxRate);

        // Calculated fields
        const updates = { taxAmount: c.taxPU, profit: c.profitPU, margin: c.margin, frontGP: c.frontGP, backGP: c.backGP, compGP: c.compGP, compMargin: c.compMargin };
        for (const k in updates) {
            if (k === src) continue;
            const el = card.querySelector('[data-field="' + k + '"]');
            if (el && document.activeElement !== el) el.value = fmt(updates[k]);
        }

        // Result box colors
        const myBox = card.querySelector('.result-box:not(.partner-result)');
        setClass(myBox, c.profitPU);
        const ptBox = card.querySelector('.partner-result');
        setClass(ptBox, c.compGP);

        // Profit text color
        const profitInput = card.querySelector('[data-field="profit"]');
        if (profitInput) { profitInput.classList.remove('profit-pos', 'profit-neg'); profitInput.classList.add(c.profitPU >= 0 ? 'profit-pos' : 'profit-neg'); }

        updateSummary();
    }

    function updateSummary() {
        const s = calcSummary();
        setText('sTotalCost', s.totalCost);
        setText('sTotalSupply', s.totalSupply);
        setText('sTotalFees', s.totalFees);
        setText('sTotalTax', s.totalTax);
        setText('sTotalFrontGP', s.totalFrontGP);
        setText('sTotalBackGP', s.totalBackGP);

        ['sTotalProfit', 'sTotalMargin', 'sTotalCompGP', 'sTotalCompMargin'].forEach(function (id) {
            const el = document.getElementById(id);
            if (el && document.activeElement !== el) el.value = '';
        });
        const profitEl = document.getElementById('sTotalProfit');
        if (profitEl && document.activeElement !== profitEl) profitEl.value = fmt(s.totalProfit);
        const marginEl = document.getElementById('sTotalMargin');
        if (marginEl && document.activeElement !== marginEl) marginEl.value = fmt(s.totalMargin);
        const compGPEl = document.getElementById('sTotalCompGP');
        if (compGPEl && document.activeElement !== compGPEl) compGPEl.value = fmt(s.totalCompGP);
        const compMarginEl = document.getElementById('sTotalCompMargin');
        if (compMarginEl && document.activeElement !== compMarginEl) compMarginEl.value = fmt(s.totalCompMargin);

        // Color
        if (profitEl) { profitEl.classList.remove('profit-pos', 'profit-neg'); profitEl.classList.add(s.totalProfit >= 0 ? 'profit-pos' : 'profit-neg'); }
    }

    // ===== Field Change Handlers =====
    function handleField(pid, field, value) {
        const p = findP(pid); if (!p) return;

        switch (field) {
            case 'costPrice': p.costPrice = value; updateProduct(pid, field); break;
            case 'supplyPrice': p.supplyPrice = value; updateProduct(pid, field); break;
            case 'quantity': p.quantity = value; updateProduct(pid, field); break;
            case 'retailPrice': p.retailPrice = value; updateProduct(pid, field); break;
            case 'taxAmount': {
                // override tax amount, recalc profit
                const fd = decompFees(p.fees);
                const feePU = fd.fixed + (p.quantity > 0 ? fd.lump / p.quantity : 0) + p.supplyPrice * fd.pct / 100;
                const profit = p.supplyPrice - p.costPrice - feePU - value;
                // show updated profit but don't change supplyPrice
                const card = getCard(pid);
                const profitEl = card ? card.querySelector('[data-field="profit"]') : null;
                if (profitEl && document.activeElement !== profitEl) profitEl.value = fmt(profit);
                updateProduct(pid, field);
                break;
            }
            case 'profit': {
                const newS = revSupplyFromProfit(p, value);
                if (newS !== null && isFinite(newS) && newS >= 0) {
                    p.supplyPrice = newS;
                    setField(pid, 'supplyPrice', newS);
                }
                updateProduct(pid, field);
                break;
            }
            case 'margin': {
                const newS = revSupplyFromMargin(p, value);
                if (newS !== null && isFinite(newS) && newS >= 0) {
                    p.supplyPrice = newS;
                    setField(pid, 'supplyPrice', newS);
                }
                updateProduct(pid, field);
                break;
            }
            case 'frontGP': {
                p.retailPrice = p.supplyPrice + value;
                setField(pid, 'retailPrice', p.retailPrice);
                updateProduct(pid, field);
                break;
            }
            case 'compGP': {
                const calc = calcProduct(p);
                const newFront = value - calc.backGP;
                p.retailPrice = p.supplyPrice + newFront;
                setField(pid, 'retailPrice', p.retailPrice);
                updateProduct(pid, field);
                break;
            }
            case 'compMargin': {
                const newR = revRetailFromCompMargin(p, value);
                if (newR !== null && isFinite(newR)) {
                    p.retailPrice = newR;
                    setField(pid, 'retailPrice', newR);
                }
                updateProduct(pid, field);
                break;
            }
        }
    }

    function handleFeeChange(pid, fid, ffield, value) {
        const p = findP(pid); if (!p) return;
        const f = findF(p, fid); if (!f) return;

        if (ffield === 'amount') f.amount = value;
        else if (ffield === 'name') f.name = String(value);
        else if (ffield === 'type') {
            f.type = value;
            // Update unit label
            const card = getCard(pid);
            if (card) {
                const feeRow = card.querySelector('[data-fid="' + fid + '"]');
                if (feeRow) {
                    const unitSpan = feeRow.querySelector('.fee-unit');
                    if (unitSpan) unitSpan.textContent = feeUnitLabel(value);
                }
            }
        }
        updateProduct(pid, null);
    }

    // ===== Summary Reverse =====
    function handleSummaryField(field, value) {
        if (state.products.length === 0) return;

        if (field === 'sTotalProfit') {
            const calcs = state.products.map(function (p) { return { p: p, calc: calcProduct(p) }; });
            const curTotal = calcs.reduce(function (s, c) { return s + c.calc.totalProfit; }, 0);
            calcs.forEach(function (item) {
                let targetProfit;
                if (curTotal === 0) {
                    targetProfit = value / state.products.length / (item.p.quantity || 1);
                } else {
                    const ratio = item.calc.totalProfit / curTotal;
                    targetProfit = value * ratio / (item.p.quantity || 1);
                }
                const newS = revSupplyFromProfit(item.p, targetProfit);
                if (newS !== null && isFinite(newS) && newS >= 0) {
                    item.p.supplyPrice = newS;
                }
            });
            state.products.forEach(function (p) { updateProduct(p.id, 'profit'); });
        } else if (field === 'sTotalMargin') {
            state.products.forEach(function (p) {
                const newS = revSupplyFromMargin(p, value);
                if (newS !== null && isFinite(newS) && newS >= 0) {
                    p.supplyPrice = newS;
                }
            });
            state.products.forEach(function (p) { updateProduct(p.id, 'margin'); });
        } else if (field === 'sTotalCompGP') {
            const calcs = state.products.map(function (p) { return { p: p, calc: calcProduct(p) }; });
            const curTotal = calcs.reduce(function (s, c) { return s + c.calc.compGP * (c.p.quantity || 0); }, 0);
            calcs.forEach(function (item) {
                let targetCompGP;
                if (curTotal === 0) {
                    targetCompGP = value / state.products.length;
                } else {
                    const cur = item.calc.compGP * (item.p.quantity || 0);
                    targetCompGP = value * (cur / curTotal) / (item.p.quantity || 1);
                }
                const newFront = targetCompGP - item.calc.backGP;
                item.p.retailPrice = item.p.supplyPrice + newFront;
            });
            state.products.forEach(function (p) { updateProduct(p.id, 'compGP'); });
        } else if (field === 'sTotalCompMargin') {
            state.products.forEach(function (p) {
                const newR = revRetailFromCompMargin(p, value);
                if (newR !== null && isFinite(newR)) {
                    p.retailPrice = newR;
                }
            });
            state.products.forEach(function (p) { updateProduct(p.id, 'compMargin'); });
        }
    }

    // ===== Render All =====
    function renderAll() {
        const container = $('#productsContainer');
        container.innerHTML = state.products.map(renderProduct).join('');
        updateSummary();
    }

    // ===== Event Binding =====
    function init() {
        // Add first product
        state.products.push(createProduct());

        // Tax mode
        $('#taxModeGroup').addEventListener('click', function (e) {
            const btn = e.target.closest('.btn-mode');
            if (!btn) return;
            $$('#taxModeGroup .btn-mode').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            state.taxMode = btn.dataset.mode;
            state.products.forEach(function (p) { updateProduct(p.id, null); });
        });

        // Tax rate
        $('#globalTaxRate').addEventListener('input', function () {
            state.taxRate = parseFloat(this.value) || 0;
            state.products.forEach(function (p) { updateProduct(p.id, null); });
        });

        // Product container events (delegation)
        const pc = $('#productsContainer');

        pc.addEventListener('input', function (e) {
            const el = e.target;
            const card = el.closest('[data-pid]');
            if (!card) return;
            const pid = parseInt(card.dataset.pid);
            const field = el.dataset.field;
            const ffield = el.dataset.ffield;

            if (field) {
                if (field === 'name') { findP(pid).name = el.value; return; }
                handleField(pid, field, parseFloat(el.value) || 0);
            } else if (ffield) {
                const feeRow = el.closest('[data-fid]');
                if (feeRow) {
                    const fid = parseInt(feeRow.dataset.fid);
                    handleFeeChange(pid, fid, ffield, ffield === 'name' ? el.value : (parseFloat(el.value) || 0));
                }
            }
        });

        pc.addEventListener('change', function (e) {
            const el = e.target;
            if (!el.classList.contains('fee-type-select')) return;
            const card = el.closest('[data-pid]');
            if (!card) return;
            const pid = parseInt(card.dataset.pid);
            const feeRow = el.closest('[data-fid]');
            if (feeRow) {
                const fid = parseInt(feeRow.dataset.fid);
                handleFeeChange(pid, fid, 'type', el.value);
            }
        });

        pc.addEventListener('click', function (e) {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const card = btn.closest('[data-pid]');
            if (!card) return;
            const pid = parseInt(card.dataset.pid);
            const action = btn.dataset.action;

            if (action === 'toggle-card') {
                const p = findP(pid);
                p.collapsed = !p.collapsed;
                card.classList.toggle('collapsed', p.collapsed);
                btn.innerHTML = p.collapsed ? '&#9654;' : '&#9660;';
            } else if (action === 'remove-card') {
                if (state.products.length <= 1) return;
                state.products = state.products.filter(function (p) { return p.id !== pid; });
                card.remove();
                updateSummary();
            } else if (action === 'toggle-fees') {
                const p = findP(pid);
                p.feesCollapsed = !p.feesCollapsed;
                const feesList = card.querySelector('.fees-list');
                feesList.classList.toggle('hidden', p.feesCollapsed);
                btn.textContent = p.feesCollapsed ? '展开' : '收起';
            } else if (action === 'add-fee') {
                const p = findP(pid);
                const newFee = { id: nid(), name: '新费用', amount: 0, type: 'per_unit' };
                p.fees.push(newFee);
                const feesList = card.querySelector('.fees-list');
                const addBtn = feesList.querySelector('.btn-add-fee');
                const div = document.createElement('div');
                div.innerHTML = renderFeeRow(pid, newFee);
                feesList.insertBefore(div.firstElementChild, addBtn);
            } else if (action === 'remove-fee') {
                const feeRow = btn.closest('[data-fid]');
                const fid = parseInt(feeRow.dataset.fid);
                const p = findP(pid);
                p.fees = p.fees.filter(function (f) { return f.id !== fid; });
                feeRow.remove();
                updateProduct(pid, null);
            }
        });

        // Add product
        $('#addProductBtn').addEventListener('click', function () {
            if (state.products.length >= 10) return;
            const p = createProduct();
            state.products.push(p);
            const container = $('#productsContainer');
            container.insertAdjacentHTML('beforeend', renderProduct(p));
            updateSummary();
        });

        // Summary inputs
        ['sTotalProfit', 'sTotalMargin', 'sTotalCompGP', 'sTotalCompMargin'].forEach(function (id) {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', function () {
                handleSummaryField(id, parseFloat(this.value) || 0);
            });
        });

        // Reset
        $('#resetBtn').addEventListener('click', function () {
            state.products = [createProduct()];
            renderAll();
        });

        // Initial render
        renderAll();
    }

    init();
})();
