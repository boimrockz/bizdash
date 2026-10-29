'use strict';

/**
 * Laporan keuangan tiga lapis: Laba Rugi, Arus Kas, dan Neraca.
 *
 * Prinsip:
 * - Semua angka berasal dari data yang benar-benar tercatat (sales, transactions, stok),
 *   bukan angka karangan. Yang tidak bisa diturunkan otomatis (kas awal, utang, modal,
 *   aset tetap) disimpan di tabel `fin_accounts` dan bisa diedit pengguna.
 * - Neraca selalu seimbang: komponen otomatis (kas & persediaan) dihitung, sisanya
 *   diselesaikan sebagai "laba ditahan" sehingga Total Aset = Kewajiban + Ekuitas.
 */

const U = require('./util');
const settings = require('./settings');

const TYPE_LABEL = {
  cash: 'Kas & bank',
  receivable: 'Piutang usaha',
  inventory_other: 'Persediaan lain (perlengkapan)',
  fixed_asset: 'Aset tetap',
  accum_dep: 'Akumulasi penyusutan',
  payable: 'Utang usaha',
  tax_payable: 'Utang pajak',
  loan: 'Utang bank / leasing',
  equity: 'Modal disetor',
};

const TYPE_GROUP = {
  cash: 'asset',
  receivable: 'asset',
  inventory_other: 'asset',
  fixed_asset: 'asset',
  accum_dep: 'asset',
  payable: 'liability',
  tax_payable: 'liability',
  loan: 'liability',
  equity: 'equity',
};

const CASH_GROUP_LABEL = {
  operating: 'Operasional',
  investing: 'Investasi',
  financing: 'Pendanaan',
};

function ph(n) {
  return new Array(n).fill('?').join(',');
}

function round(n) {
  return Math.round(Number(n) || 0);
}

// ------------------------------------------------------------------ LABA RUGI
/**
 * Laba rugi multi-langkah untuk satu periode (bulan).
 * Beban dipisah per kategori; penyusutan diambil dari akun aset tetap.
 */
function profitLoss(db, ids, month) {
  if (!ids.length) {
    return { revenue: 0, cogs: 0, gross: 0, expenseRows: [], expenses: 0, ebitda: 0,
      depreciation: 0, operatingProfit: 0, otherIncome: 0, otherExpense: 0,
      pretax: 0, taxRate: 0, tax: 0, net: 0, margin: 0, grossMargin: 0 };
  }
  const p = ph(ids.length);
  const sales = db.prepare(`SELECT COALESCE(SUM(total),0) revenue, COALESCE(SUM(cogs),0) cogs, COUNT(*) n
    FROM sales WHERE status='paid' AND company_id IN (${p}) AND substr(sold_at,1,7) = ?`).get(...ids, month);

  const tx = db.prepare(`SELECT type, COALESCE(category,'Lain-lain') category, COALESCE(SUM(amount),0) amount
    FROM transactions WHERE company_id IN (${p}) AND substr(occurred_at,1,7) = ?
    GROUP BY type, category ORDER BY amount DESC`).all(...ids, month);
  const expenseRows = tx.filter((t) => t.type === 'expense');
  const incomeRows = tx.filter((t) => t.type === 'income');
  const expenses = expenseRows.reduce((a, r) => a + r.amount, 0);
  const otherIncome = incomeRows.reduce((a, r) => a + r.amount, 0);

  const depreciation = round(db.prepare(`SELECT COALESCE(SUM(monthly_depreciation),0) v FROM fin_accounts
    WHERE company_id IN (${p}) AND type = 'fixed_asset' AND active = 1`).get(...ids).v);

  const revenue = sales.revenue;
  const cogs = sales.cogs;
  const gross = revenue - cogs;
  const ebitda = gross - expenses;
  const operatingProfit = ebitda - depreciation;
  const pretax = operatingProfit + otherIncome;
  const taxRate = Number(settings.get(db, 'tax_rate', '0.5')) || 0;
  const tax = round(Math.max(0, pretax) * (taxRate / 100));
  const net = pretax - tax;

  return {
    revenue, cogs, gross, expenseRows, incomeRows, expenses, ebitda,
    depreciation, operatingProfit, otherIncome, otherExpense: 0, pretax,
    taxRate, tax, net,
    transactions: sales.n,
    margin: revenue ? (net / revenue) * 100 : 0,
    grossMargin: revenue ? (gross / revenue) * 100 : 0,
    operatingMargin: revenue ? (operatingProfit / revenue) * 100 : 0,
  };
}

// ------------------------------------------------------------------ ARUS KAS
/**
 * Arus kas per kelompok (operasional / investasi / pendanaan) untuk satu periode.
 * Penerimaan penjualan = omzet lunas; pengeluaran HPP = cogs (pembelian bahan dianggap
 * tunai pada periode yang sama) — cukup akurat untuk usaha retail kopi skala kecil.
 */
function cashFlow(db, ids, month) {
  const pl = profitLoss(db, ids, month);
  const p = ph(ids.length) || 'NULL';

  const byGroup = { operating: { in: 0, out: 0 }, investing: { in: 0, out: 0 }, financing: { in: 0, out: 0 } };
  const rows = db.prepare(`SELECT COALESCE(cash_group,'operating') grp, type, COALESCE(SUM(amount),0) amount
    FROM transactions WHERE company_id IN (${p}) AND substr(occurred_at,1,7) = ? GROUP BY grp, type`).all(...ids, month);
  for (const r of rows) {
    const group = byGroup[r.grp] ? r.grp : 'operating';
    if (r.type === 'expense') byGroup[group].out += r.amount;
    else byGroup[group].in += r.amount;
  }

  const operatingIn = pl.revenue + (byGroup.operating.in || 0);
  const operatingOut = pl.cogs + (byGroup.operating.out || 0);
  const operating = operatingIn - operatingOut;
  const investing = byGroup.investing.in - byGroup.investing.out;
  const financing = byGroup.financing.in - byGroup.financing.out;

  // saldo kas awal periode = kas awal (akun) + akumulasi arus kas sebelum bulan ini
  const openingCash = round(db.prepare(`SELECT COALESCE(SUM(balance),0) v FROM fin_accounts
    WHERE company_id IN (${p}) AND type = 'cash' AND active = 1`).get(...ids).v);
  const before = subqueryBefore(db, ids, month);
  const beginBalance = openingCash + before;
  const endBalance = beginBalance + operating + investing + financing;

  return {
    month,
    pl,
    groups: byGroup,
    operatingIn, operatingOut, operating,
    investing, financing,
    netChange: operating + investing + financing,
    openingCash,
    beginBalance,
    endBalance,
  };
}

/** Akumulasi arus kas untuk semua periode sebelum `month` (batas awal data). */
function subqueryBefore(db, ids, month) {
  if (!ids.length) return 0;
  const p = ph(ids.length);
  const sales = db.prepare(`SELECT COALESCE(SUM(total),0) rev, COALESCE(SUM(cogs),0) cogs FROM sales
    WHERE status='paid' AND company_id IN (${p}) AND substr(sold_at,1,7) < ?`).get(...ids, month);
  const tx = db.prepare(`SELECT type, COALESCE(SUM(amount),0) amount FROM transactions
    WHERE company_id IN (${p}) AND substr(occurred_at,1,7) < ? GROUP BY type`).all(...ids, month);
  const income = (tx.find((t) => t.type === 'income') || {}).amount || 0;
  const expense = (tx.find((t) => t.type === 'expense') || {}).amount || 0;
  return round(sales.rev - sales.cogs + income - expense);
}

// ------------------------------------------------------------------ NERACA
function accounts(db, ids) {
  if (!ids.length) return [];
  const p = ph(ids.length);
  return db.prepare(`SELECT a.*, c.name company_name FROM fin_accounts a LEFT JOIN companies c ON c.id = a.company_id
    WHERE a.company_id IN (${p}) AND a.active = 1 ORDER BY a.sort_order, a.id`).all(...ids);
}

/**
 * Neraca per akhir bulan (as-of `month`).
 * Aset & kewajiban dari akun; kas dan persediaan dihitung otomatis dari transaksi & stok.
 * Ekuitas = modal disetor + laba ditahan (penyeimbang) sehingga neraca selalu balance.
 */
function balanceSheet(db, ids, month) {
  if (!ids.length) {
    return { groups: [], totalAssets: 0, totalLiabilities: 0, totalEquity: 0, retained: 0,
      capital: 0, auto: {}, accounts: [], balanced: true };
  }
  const p = ph(ids.length);
  const acc = accounts(db, ids);
  const cash = cashFlow(db, ids, month);

  // persediaan bahan baku + produk jadi (dinilai dengan harga pokok)
  const materialValue = round(db.prepare(`SELECT COALESCE(SUM(stock * cost),0) v FROM materials
    WHERE company_id IN (${p}) AND active = 1`).get(...ids).v);
  const productValue = round(db.prepare(`SELECT COALESCE(SUM(stock * cost),0) v FROM products
    WHERE company_id IN (${p}) AND active = 1 AND stock > 0`).get(...ids).v);

  const groupOf = (type) => TYPE_GROUP[type] || 'asset';
  const sumType = (type) => round(acc.filter((a) => a.type === type).reduce((a, b) => a + b.balance, 0));

  const receivable = sumType('receivable');
  const inventoryOther = sumType('inventory_other');
  const fixedAssets = sumType('fixed_asset');
  const accumDep = sumType('accum_dep');
  const payable = sumType('payable');
  const taxPayable = sumType('tax_payable');
  const loan = sumType('loan');
  const capital = sumType('equity');

  const currentAssets = cash.endBalance + receivable + materialValue + productValue + inventoryOther;
  const totalAssets = currentAssets + fixedAssets - accumDep;
  const totalLiabilities = payable + taxPayable + loan;

  // laba ditahan = penyeimbang (aset - kewajiban - modal disetor)
  const retained = totalAssets - totalLiabilities - capital;
  const totalEquity = capital + retained;

  const groups = [
    {
      label: 'Aset Lancar',
      group: 'asset',
      rows: [
        { label: 'Kas & setara kas', value: cash.endBalance, auto: true },
        { label: 'Piutang usaha', value: receivable },
        { label: 'Persediaan bahan baku', value: materialValue, auto: true },
        { label: 'Persediaan produk jadi', value: productValue, auto: true },
        { label: 'Perlengkapan & persediaan lain', value: inventoryOther },
      ].filter((r) => r.value !== 0 || r.auto),
      total: currentAssets,
    },
    {
      label: 'Aset Tetap',
      group: 'asset',
      rows: [
        { label: 'Peralatan & aset tetap', value: fixedAssets },
        { label: 'Akumulasi penyusutan', value: -accumDep },
      ].filter((r) => r.value !== 0),
      total: fixedAssets - accumDep,
    },
    {
      label: 'Kewajiban',
      group: 'liability',
      rows: [
        { label: 'Utang usaha (pemasok)', value: payable },
        { label: 'Utang pajak', value: taxPayable },
        { label: 'Utang bank / leasing', value: loan },
      ].filter((r) => r.value !== 0),
      total: totalLiabilities,
    },
    {
      label: 'Ekuitas',
      group: 'equity',
      rows: [
        { label: 'Modal disetor', value: capital },
        { label: 'Laba ditahan (akumulasi)', value: retained, auto: true },
      ],
      total: totalEquity,
    },
  ];

  return {
    month,
    groups,
    currentAssets,
    totalAssets,
    totalLiabilities,
    totalEquity,
    capital,
    retained,
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1,
    auto: { cash: cash.endBalance, materialValue, productValue },
    cash,
    accounts: acc,
  };
}

/** Ringkasan tiga laporan untuk kartu angka besar di halaman keuangan. */
function summary(db, ids, month) {
  const pl = profitLoss(db, ids, month);
  const cf = cashFlow(db, ids, month);
  const bs = balanceSheet(db, ids, month);
  return { pl, cf, bs };
}

module.exports = {
  profitLoss, cashFlow, balanceSheet, accounts, summary,
  TYPE_LABEL, TYPE_GROUP, CASH_GROUP_LABEL, subqueryBefore,
};
