'use strict';

const settings = require('./settings');

const PROVIDERS = {
  none: { label: 'Belum terhubung (simulasi)', hint: 'Laporan tetap disusun dan dicatat di riwayat, tanpa dikirim.' },
  resend: { label: 'Resend', hint: 'API key diawali re_. Endpoint: https://api.resend.com/emails' },
  sendgrid: { label: 'SendGrid', hint: 'API key diawali SG_. Endpoint: https://api.sendgrid.com/v3/mail/send' },
  mailgun: { label: 'Mailgun', hint: 'Butuh API key + domain pengirim.' },
  webhook: { label: 'Webhook email sendiri', hint: 'POST JSON {to, subject, html, text} ke URL Anda (mis. Zapier/Make/n8n).' },
};

function provider(db) {
  const p = settings.get(db, 'mail_provider', 'none');
  return PROVIDERS[p] ? p : 'none';
}

function mode(db) {
  const p = provider(db);
  const key = settings.get(db, 'mail_api_key');
  const needsKey = p !== 'none' && p !== 'webhook';
  return {
    provider: p,
    label: PROVIDERS[p].label,
    live: p === 'webhook' ? !!settings.get(db, 'mail_webhook_url') : (needsKey ? !!key : false),
    keyMasked: key ? settings.mask(key) : '',
    from: settings.get(db, 'mail_from', ''),
  };
}

async function sendWithTimeout(url, opts, ms = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Kirim email. Mengembalikan { ok, simulated } — bila belum dikonfigurasi,
 * laporan TIDAK dibuang tapi ditandai simulasi (bisa dikirim ulang).
 */
async function send(db, opts) {
  const { to, subject, html, text } = opts;
  const recipients = String(to || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!recipients.length) return { ok: false, error: 'Alamat email tujuan kosong.' };

  const p = provider(db);
  const key = settings.get(db, 'mail_api_key');
  const from = settings.get(db, 'mail_from') || 'laporan@example.com';
  const replyTo = settings.get(db, 'mail_reply_to') || undefined;

  if (p === 'none' || (!key && p !== 'webhook')) {
    return { ok: true, simulated: true, recipients, provider: p };
  }

  try {
    if (p === 'resend') {
      const res = await sendWithTimeout('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: recipients, subject, html, text, reply_to: replyTo }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`);
      return { ok: true, simulated: false, provider: p, id: json.id };
    }
    if (p === 'sendgrid') {
      const res = await sendWithTimeout('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: recipients.map((r) => ({ email: r })) }],
          from: { email: from },
          reply_to: replyTo ? { email: replyTo } : undefined,
          subject,
          content: [
            { type: 'text/plain', value: text || '' },
            { type: 'text/html', value: html || '' },
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${body.slice(0, 160)}`);
      }
      return { ok: true, simulated: false, provider: p };
    }
    if (p === 'mailgun') {
      const domain = settings.get(db, 'mail_domain');
      const base = settings.get(db, 'mail_api_url') || 'https://api.mailgun.net/v3';
      if (!domain) throw new Error('Domain Mailgun belum diisi.');
      const body = new URLSearchParams({ from, to: recipients.join(','), subject, html, text: text || '' });
      const res = await sendWithTimeout(`${base}/${domain}/messages`, {
        method: 'POST',
        headers: { Authorization: 'Basic ' + Buffer.from('api:' + key).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { ok: true, simulated: false, provider: p };
    }
    if (p === 'webhook') {
      const url = settings.get(db, 'mail_webhook_url');
      if (!url) throw new Error('URL webhook email belum diisi.');
      const res = await sendWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: recipients, subject, html, text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { ok: true, simulated: false, provider: p };
    }
  } catch (err) {
    return { ok: false, error: String(err.message || err).slice(0, 300), recipients, provider: p };
  }
  return { ok: false, error: 'Provider tidak dikenal.' };
}

module.exports = { PROVIDERS, provider, mode, send };
