'use strict';

const U = require('./util');
const { RACI_STATUS } = require('./queries');

// Menyusun alert lintas modul untuk dashboard eksekutif.
function buildAlerts({ fin, prev, target, bsc, kpis, okrs, raci, month, materials, promo, shippingActive }) {
  const alerts = [];
  const today = U.todayISO();

  for (const k of kpis) {
    if (!k.hasActual) continue;
    if (k.score < 70) {
      alerts.push({
        tone: 'bad', icon: 'alert', weight: 100 - k.score,
        title: `KPI berisiko: ${k.name}`,
        detail: `${U.formatValue(k.actual, k.unit)} dari target ${U.formatValue(k.target_value, k.unit)} (skor ${U.pct(k.score, 0)}) · PIC ${k.owner_name || 'belum ditentukan'}`,
      });
    } else if (k.score < 85) {
      alerts.push({
        tone: 'warn', icon: 'gauge', weight: 50 - k.score,
        title: `KPI perlu perhatian: ${k.name}`,
        detail: `Pencapaian ${U.pct(k.score, 0)} — ${k.owner_name || 'PIC'} perlu rencana perbaikan bulan ini.`,
      });
    }
  }

  if (target && fin.revenue < target * 0.9) {
    alerts.push({
      tone: 'warn', icon: 'trendDown', weight: 55,
      title: 'Realisasi pendapatan di bawah target',
      detail: `${U.idrShort(fin.revenue)} dari target ${U.idrShort(target)} (${U.pct((fin.revenue / target) * 100, 0)}) pada ${U.monthLabel(month)}.`,
    });
  }

  if (fin.margin < 8 && fin.revenue > 0) {
    alerts.push({
      tone: 'bad', icon: 'wallet', weight: 90,
      title: 'Margin laba bersih menipis',
      detail: `Margin ${U.pct(fin.margin)} — beban ${U.idrShort(fin.expenses)} vs laba kotor ${U.idrShort(fin.gross)}.`,
    });
  }

  if (bsc && bsc.overall) {
    const weak = bsc.perspectives.filter((p) => p.kpiCount > 0 && p.score < 70);
    for (const p of weak) {
      alerts.push({
        tone: 'warn', icon: 'layers', weight: 40,
        title: `Perspektif ${p.label} tertinggal`,
        detail: `Skor ${U.pct(p.score, 0)} dari target 100% — tinjau ulang inisiatif pada perspektif ini.`,
      });
    }
  }

  for (const o of okrs) {
    if (o.status === 'off_track') {
      alerts.push({ tone: 'bad', icon: 'target', weight: 88, title: `OKR off track: ${o.title}`, detail: `Progres ${U.pct(o.progress, 0)} · PIC ${o.owner_name || '—'}.` });
    } else if (o.status === 'at_risk') {
      alerts.push({ tone: 'warn', icon: 'target', weight: 65, title: `OKR berisiko: ${o.title}`, detail: `Progres ${U.pct(o.progress, 0)} · PIC ${o.owner_name || '—'}.` });
    }
  }

  if (materials && materials.low && materials.low.length) {
    for (const m of materials.low.slice(0, 2)) {
      alerts.push({
        tone: m.stock <= 0 ? 'bad' : 'warn', icon: 'sprinkle', weight: 70,
        title: `Stok ${m.name} menipis`,
        detail: `${m.company_name} · sisa ${Number(m.stock).toLocaleString('id-ID')} ${m.unit} (minimum ${Number(m.min_stock).toLocaleString('id-ID')} ${m.unit}). Segera restock.`,
      });
    }
  }

  if (promo && promo.length) {
    const totalDiscount = promo.reduce((a, r) => a + r.discount, 0);
    if (fin.revenue && totalDiscount / fin.revenue > 0.03) {
      alerts.push({
        tone: 'info', icon: 'gift', weight: 30,
        title: 'Diskon promo cukup besar bulan ini',
        detail: `Total diskon ${U.idrShort(totalDiscount)} (${U.pct((totalDiscount / fin.revenue) * 100)} dari pendapatan) — evaluasi promo paling boros.`,
      });
    }
  }

  for (const r of raci) {
    if (r.status === 'blocked') {
      alerts.push({ tone: 'bad', icon: 'users', weight: 85, title: `Aktivitas terhambat: ${r.activity}`, detail: `PIC ${r.responsible_name || '—'} · tenggat ${r.due_date || '—'}. Butuh eskalasi.` });
    } else if (r.status !== 'done' && r.due_date && r.due_date < today) {
      alerts.push({ tone: 'warn', icon: 'clock', weight: 45, title: `Melewati tenggat: ${r.activity}`, detail: `Tenggat ${r.due_date} · progres ${U.pct(r.progress, 0)}.` });
    }
  }

  if (Array.isArray(shippingActive)) {
    for (const sh of shippingActive) {
      const last = String(sh.last_event || sh.created_at || '');
      const days = last ? (Date.now() - new Date(last.replace(' ', 'T') + '+07:00').getTime()) / 86400000 : 0;
      if (days >= 3) {
        alerts.push({
          tone: 'warn', icon: 'truck', weight: 42,
          title: `Pengiriman ${sh.awb || '—'} belum bergerak`,
          detail: `${sh.dest_name || 'penerima'} · ${sh.dest_area || ''} · terakhir update ${Math.floor(days)} hari lalu. Cek status ke kurir.`,
        });
      }
      if (sh.status === 'returned') {
        alerts.push({ tone: 'bad', icon: 'truck', weight: 78, title: `Paket dikembalikan: ${sh.awb}`, detail: `${sh.dest_name || ''} — hubungi pelanggan untuk alamat ulang.` });
      }
    }
  }

  return alerts.sort((a, b) => b.weight - a.weight).slice(0, 7);
}

module.exports = { buildAlerts, RACI_STATUS };
