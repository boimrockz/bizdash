'use strict';

const U = require('../lib/util');
const L = require('./layout');
const { can } = require('../lib/auth');
const curriculum = require('../lib/lms/curriculum');
const video = require('../lib/video');

const { TRACK_LABEL, TRACK_TONE, LEVEL_LABEL } = curriculum;

/** Warna level: barista muda → hijau, hospitality → kuning, jenjang jabatan → merah brand. */
const LEVEL_TONE = { FND: 'indigo', HOS: 'warn', B2: 'good', B3: 'bad', SUP: 'good', MGR: 'indigo', DIR: 'bad' };

function levelPill(level) {
  return L.badge(LEVEL_LABEL[level] || level, LEVEL_TONE[level] || 'good');
}

function statusPill(status) {
  const map = {
    assigned: ['Ditugaskan', 'muted'],
    in_progress: ['Sedang belajar', 'indigo'],
    theory_passed: ['Teori lulus', 'warn'],
    completed: ['Lulus', 'good'],
  };
  const [label, tone] = map[status] || [status, 'muted'];
  return L.badge(label, tone);
}

function badgeChips(badges) {
  if (!badges.length) return '<span class="hint-text">Belum ada badge.</span>';
  return `<div class="badge-row">${badges.map((b) => `<span class="acad-badge" title="${U.h(b.meta.requirement || '')}">
      ${L.icon(b.meta.icon || 'trophy', 15)}<b>${U.h(b.meta.name || b.badge)}</b></span>`).join('')}</div>`;
}

// ---------------------------------------------------------------- dashboard

function academyPage(ctx, data) {
  const { mine, kpi, users, paths, activity, canAssess, canManage, selectedUser } = data;
  const s = mine.summary;
  const active = mine.progress.filter((p) => p.status !== 'completed');
  const done = mine.progress.filter((p) => p.status === 'completed');

  const row = (p) => `<tr>
    <td><a class="strong" href="${ctx.base}/academy/course/${U.h(p.code)}">${U.h(p.code)}</a>
      <span class="sub-cell">${U.h(p.title)}</span></td>
    <td>${L.badge(TRACK_LABEL[p.track] || p.track, TRACK_TONE[p.track] || 'muted')}</td>
    <td>${levelPill(p.level)}</td>
    <td class="num">${p.sectionsDone}/${p.sections}</td>
    <td class="num">${p.theory_score ? U.num(p.theory_score) : '—'}</td>
    <td class="num">${p.practical_score ? U.num(p.practical_score) : '—'}</td>
    <td>${statusPill(p.status)}</td>
    <td class="num">${p.due_date ? (p.due_date < U.todayISO() && p.status !== 'completed' ? L.badge(p.due_date, 'bad') : U.h(p.due_date)) : '—'}</td>
  </tr>`;

  const userOptions = users.map((u) => `<option value="${u.id}" ${Number(selectedUser) === u.id ? 'selected' : ''}>${U.h(u.name)} · ${U.h(u.job_title || U.role || '')}</option>`).join('');

  const body = `
    ${canAssess || canManage ? `<div class="grid grid-4">
      ${[
        ['Penyelesaian modul', U.pct(kpi.completion, 0), `${kpi.completed} dari ${kpi.assigned} penugasan`],
        ['Lulus teori', U.pct(kpi.passRate, 0), 'rata-rata percobaan kuis'],
        ['Lulus praktik', U.pct(kpi.practicalPassRate, 0), 'asesmen trainer'],
        ['Cakupan sertifikat', U.pct(kpi.certificateCoverage, 0), `${kpi.certificates} sertifikat aktif · ${kpi.badges} badge`],
      ].map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value">${value}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>` : ''}

    <div class="grid grid-side">
      ${L.card({ title: 'Progres saya', subtitle: `${s.completed}/${s.assigned} modul lulus · ${s.minutes} menit materi · ${U.num(s.points)} poin belajar` }, `
        ${L.pbar(s.completion, 'indigo', 10)}
        <div class="acad-stats">
          <div><span>Modul aktif</span><b>${U.num(active.length)}</b></div>
          <div><span>Terlambat</span><b>${U.num(s.overdue)}</b></div>
          <div><span>Badge</span><b>${U.num(s.badges.length)}</b></div>
          <div><span>Sertifikat</span><b>${U.num(s.certificates.length)}</b></div>
        </div>
        <div class="table-wrap" style="margin-top:var(--sp-4)"><table class="data">
          <thead><tr><th>Modul</th><th>Jalur</th><th>Level</th><th class="num">Materi</th><th class="num">Teori</th><th class="num">Praktik</th><th>Status</th><th class="num">Tenggat</th></tr></thead>
          <tbody>${active.slice(0, 12).map(row).join('') || `<tr><td colspan="8">${L.empty('Semua modul yang ditugaskan sudah selesai. Bagus!')}</td></tr>`}</tbody>
        </table></div>
        ${active.length > 12 ? `<p class="hint-text">Menampilkan 12 modul terdekat. Lihat semua di <a href="${ctx.base}/academy/paths">learning path</a>.</p>` : ''}`)}

      <div class="grid" style="gap:var(--gap-card)">
        ${L.card({ title: 'Badge & sertifikat', subtitle: 'Diterbitkan hanya bila kompetensi terbukti' }, `
          ${badgeChips(s.badges)}
          <div class="acad-certs">
            ${s.certificates.length ? s.certificates.map((c) => `<div class="acad-cert">
              ${L.icon('trophy', 18)}
              <div><strong>${U.h(LEVEL_LABEL[c.level] || c.level)}</strong>
                <span>${U.h(TRACK_LABEL[c.track] || c.track)} · ${U.h(c.code)}</span>
                <small>berlaku sampai ${U.h(c.expires_at || '—')}</small></div>
            </div>`).join('') : `<p class="hint-text">Belum ada sertifikat. Sertifikat terbit otomatis setelah semua modul satu level lulus teori dan praktik.</p>`}
          </div>`)}

        ${L.card({ title: 'Jalur belajar', subtitle: 'Ikuti sesuai jabatan Anda' }, `
          <div class="acad-paths">
            ${paths.map((p) => `<form method="post" action="${ctx.base}/academy/paths/${U.h(p.code)}/enroll" class="acad-path">
              <input type="hidden" name="_csrf" value="${ctx.csrf}">
              <input type="hidden" name="_back" value="/academy">
              <div>
                <strong>${U.h(p.name)}</strong>
                <span>${U.h(p.role_target || '')}</span>
                <small>${p.courses.length} modul</small>
              </div>
              <button class="btn btn-ghost btn-sm" type="submit">Tugaskan ke saya</button>
            </form>`).join('')}
          </div>`)}
      </div>
    </div>

    ${done.length ? L.card({ title: 'Modul yang sudah lulus', subtitle: `${done.length} modul` }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Modul</th><th>Jalur</th><th>Level</th><th class="num">Materi</th><th class="num">Teori</th><th class="num">Praktik</th><th>Status</th><th class="num">Tenggat</th></tr></thead>
        <tbody>${done.slice(0, 20).map(row).join('')}</tbody>
      </table></div>`) : ''}

    ${canAssess ? L.card({ title: 'Asesmen praktik & penugasan', subtitle: 'Trainer menilai rubrik dan menugaskan modul' }, `
      <div class="grid grid-2">
        <form method="get" action="${ctx.base}/academy/assess" class="stack-form">
          <label class="field"><span>Pilih karyawan</span><select name="user">${userOptions}</select></label>
          <label class="field"><span>Modul</span>
            <select name="course">${curriculum.COURSES.map((c) => `<option value="${c.code}">${c.code} · ${U.h(c.title)}</option>`).join('')}</select>
          </label>
          <div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">Buka lembar asesmen</button></div>
        </form>
        <div>
          <p class="hint-text" style="line-height:1.6">Alur penilaian: peserta menyelesaikan materi → lulus kuis teori → trainer mengisi rubrik praktik →
          sistem menghitung nilai berbobot dan menerbitkan badge/sertifikat bila semua modul satu level lulus.</p>
          <div class="form-actions">
            <a class="btn btn-ghost btn-sm" href="${ctx.base}/academy/matrix">${L.icon('users', 15)} Matriks kompetensi</a>
            <a class="btn btn-ghost btn-sm" href="${ctx.base}/academy/library">${L.icon('box', 15)} Pustaka SOP & resep</a>
            ${canManage ? `<a class="btn btn-ghost btn-sm" href="${ctx.base}/academy/manage">${L.icon('settings', 15)} Kelola kurikulum</a>` : ''}
          </div>
        </div>
      </div>`) : ''}

    ${activity && activity.length ? L.card({ title: 'Aktivitas terbaru tim', subtitle: 'Kuis & asesmen praktik' }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Waktu</th><th>Karyawan</th><th>Modul</th><th>Jenis</th><th class="num">Nilai</th><th>Hasil</th></tr></thead>
        <tbody>${activity.map((a) => `<tr>
          <td>${U.h(String(a.created_at).slice(0, 16))}</td>
          <td>${U.h(a.user_name || '—')}</td>
          <td>${U.h(a.code)}</td>
          <td>${a.kind === 'quiz' ? 'Kuis teori' : 'Praktik'}</td>
          <td class="num">${U.num(a.score)}</td>
          <td>${a.passed ? L.badge('Lulus', 'good') : L.badge('Belum lulus', 'bad')}</td>
        </tr>`).join('')}</tbody>
      </table></div>`) : ''}
  `;

  return L.shell(ctx, {
    title: 'Ondeway Coffee Academy',
    subtitle: 'Training barista & hospitality: materi, kuis, praktik, sertifikasi',
    active: '/academy',
    content: body,
  });
}

// ---------------------------------------------------------------- detail modul


/**
 * Form materi (dipakai untuk tambah & ubah). Video/PDF hanya menyimpan URL embed,
 * jadi tidak ada file yang diunggah ke server aplikasi.
 */
function materialForm(ctx, { material, action, submitLabel = 'Simpan materi' }) {
  const m = material || { kind: 'text', title: '', url: '', body: '', duration_min: 0 };
  const kinds = Object.entries(video.KINDS)
    .map(([key, meta]) => `<option value="${key}" ${m.kind === key ? 'selected' : ''}>${U.h(meta.label)}</option>`).join('');
  return `<form method="post" action="${action}" class="stack-form" data-material-form>
    <input type="hidden" name="_csrf" value="${ctx.csrf}">
    <div class="form-grid" style="gap:10px">
      <label class="field"><span>Jenis materi</span>
        <select name="kind" data-mat-kind>${kinds}</select>
      </label>
      <label class="field"><span>Judul bagian</span>
        <input name="title" value="${U.h(m.title || '')}" maxlength="160" required placeholder="mis. Video: kalibrasi grinder">
      </label>
      <label class="field"><span>Durasi (menit)</span>
        <input name="duration_min" type="number" min="0" max="600" value="${Number(m.duration_min) || 0}">
      </label>
    </div>
    <label class="field" data-mat-field="url"><span>URL video / dokumen</span>
      <input name="url" value="${U.h(m.url || '')}" placeholder="https://youtu.be/… · https://vimeo.com/… · https://drive.google.com/file/d/…/view">
    </label>
    <p class="hint-text" data-mat-hint="url">YouTube &amp; Vimeo otomatis diubah ke mode embed (tanpa membebani server).
      Link Google Drive otomatis memakai mode pratinjau. URL https lain dipasang sebagai embed bebas.</p>
    <label class="field"><span>Isi materi / catatan</span>
      <textarea name="body" rows="4" placeholder="Teks materi, poin penting, atau catatan pendamping video">${U.h(m.body || '')}</textarea>
    </label>
    <div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">${U.h(submitLabel)}</button></div>
  </form>`;
}

function coursePage(ctx, data) {
  const { course, enrollment: enr, sectionsDone, questions, attempts, practicals, docs, lastResult, canAssess, isMine, learner } = data;
  const materials = course.materials || [];
  const rubric = course.rubric || [];
  const doneCount = (sectionsDone || []).length;
  const pct = materials.length ? Math.round((doneCount / materials.length) * 100) : 0;
  const canManage = can(ctx.user, 'lms_manage');
  const action = `${ctx.base}/academy/course/${U.h(course.code)}`;
  const currentUser = learner ? learner.id : ctx.user.id;

  /** Satu bagian materi: teks, video embed, atau dokumen PDF. */
  const materialBody = (m) => {
    if (m.kind === 'video') {
      const v = video.prepare('video', m.url);
      if (!v.ok) return `<p class="hint-text">${U.h(v.error)}</p>`;
      return `<div class="acad-embed" data-embed="video" data-provider="${U.h(m.provider || v.provider)}">
        <iframe src="${U.h(v.embedUrl)}" title="${U.h(m.title)}" loading="lazy" allowfullscreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerpolicy="strict-origin-when-cross-origin"></iframe>
      </div>
      <p class="hint-text">Video diputar langsung dari ${U.h(v.label)} — tidak memakai bandwidth server aplikasi.
        <a href="${U.h(v.openUrl)}" target="_blank" rel="noopener noreferrer">Buka di tab baru</a>
        ${m.duration_min ? `· estimasi ${U.num(m.duration_min)} menit` : ''}</p>`;
    }
    if (m.kind === 'pdf') {
      const d = video.prepare('pdf', m.url);
      if (!d.ok) return `<p class="hint-text">${U.h(d.error)}</p>`;
      const frame = d.inline
        ? `<div class="acad-embed acad-embed-doc" data-embed="pdf" data-provider="${U.h(m.provider || d.provider)}">
            <iframe src="${U.h(d.embedUrl)}" title="${U.h(m.title)}" loading="lazy"></iframe>
          </div>`
        : `<p class="hint-text">Dokumen dari ${U.h(d.label)} dibuka di tab baru agar tetap aman.</p>`;
      return `${frame}
      <div class="form-actions">
        <a class="btn btn-ghost btn-sm" href="${U.h(d.openUrl)}" target="_blank" rel="noopener noreferrer">${L.icon('download', 14)} Buka dokumen PDF</a>
        ${m.duration_min ? `<span class="hint-text">estimasi ${U.num(m.duration_min)} menit</span>` : ''}
      </div>`;
    }
    return `<p>${U.h(m.body || '')}</p>`;
  };

  const kindMeta = (kind) => video.KINDS[kind] || video.KINDS.text;

  const materialsHtml = materials.map((m, i) => {
    const done = (sectionsDone || []).includes(i);
    const kind = kindMeta(m.kind);
    return `<article class="acad-material ${done ? 'is-done' : ''}" data-material="${m.id}" data-kind="${U.h(m.kind)}">
      <header>
        <div><span class="acad-mat-num">${i + 1}</span> <strong>${U.h(m.title)}</strong>
          <span class="acad-mat-media">${L.icon(kind.icon, 13)} ${U.h(kind.label)}</span></div>
        ${done ? L.badge('Selesai', 'good') : `<form method="post" action="${action}/section/${i}">
          <input type="hidden" name="_csrf" value="${ctx.csrf}">
          <input type="hidden" name="user_id" value="${currentUser}">
          <button class="btn btn-ghost btn-sm" type="submit">Tandai selesai</button>
        </form>`}
      </header>
      ${materialBody(m)}
      ${canManage ? `<details class="disclosure acad-mat-edit">
        <summary>${L.icon('settings', 14)} Ubah bagian ini</summary>
        <div class="disc-body">
          ${materialForm(ctx, { course, material: m, action: `${ctx.base}/academy/material/${m.id}/save` })}
          <div class="form-actions" style="margin-top:var(--sp-2)">
            <form method="post" action="${ctx.base}/academy/material/${m.id}/move" style="display:inline">
              <input type="hidden" name="_csrf" value="${ctx.csrf}">
              <input type="hidden" name="direction" value="up">
              <button class="btn btn-ghost btn-sm" type="submit" ${i === 0 ? 'disabled' : ''}>↑ Naik</button>
            </form>
            <form method="post" action="${ctx.base}/academy/material/${m.id}/move" style="display:inline">
              <input type="hidden" name="_csrf" value="${ctx.csrf}">
              <input type="hidden" name="direction" value="down">
              <button class="btn btn-ghost btn-sm" type="submit" ${i === materials.length - 1 ? 'disabled' : ''}>↓ Turun</button>
            </form>
            <form method="post" action="${ctx.base}/academy/material/${m.id}/delete" data-confirm="Hapus materi ${U.h(m.title)}?">
              <input type="hidden" name="_csrf" value="${ctx.csrf}">
              <button class="btn btn-danger btn-sm" type="submit">Hapus</button>
            </form>
          </div>
        </div>
      </details>` : ''}
    </article>`;
  }).join('');

  const sop = course.sop;
  const quizHtml = questions.length ? `<form method="post" action="${ctx.base}/academy/course/${U.h(course.code)}/quiz" class="acad-quiz">
    <input type="hidden" name="_csrf" value="${ctx.csrf}">
    <input type="hidden" name="_back" value="/academy/course/${U.h(course.code)}">
    ${questions.map((q, i) => `<fieldset class="acad-q">
      <legend><span>${i + 1}.</span> ${U.h(q.question)}</legend>
      ${q.options.map((opt, oi) => `<label class="acad-opt"><input type="radio" name="q_${q.id}" value="${oi}" ${isMine ? '' : 'disabled'} required>
        <span>${U.h(opt)}</span></label>`).join('')}
    </fieldset>`).join('')}
    <div class="form-actions">
      <button class="btn btn-primary" type="submit" ${isMine ? '' : 'disabled'}>Kirim jawaban</button>
      <span class="hint-text">Nilai lulus teori: ${course.pass_theory}</span>
    </div>
  </form>` : '<p class="hint-text">Modul ini belum memiliki kuis.</p>';

  const rubricHtml = rubric.length ? `<div class="table-wrap"><table class="data">
    <thead><tr><th>Aspek penilaian</th><th class="num">Bobot</th><th>Kritis</th></tr></thead>
    <tbody>${rubric.map((r) => `<tr><td>${U.h(r.aspect)}</td><td class="num">${U.num(r.weight)}%</td>
      <td>${r.critical ? L.badge('Wajib', 'bad') : '—'}</td></tr>`).join('')}
      <tr class="is-total"><td>Total</td><td class="num">${rubric.reduce((a, r) => a + r.weight, 0)}%</td><td>Nilai lulus ${course.pass_practical}</td></tr>
    </tbody></table></div>` : '<p class="hint-text">Belum ada rubrik.</p>';

  const attemptRows = (attempts || []).map((a) => `<tr>
    <td>${U.h(String(a.created_at).slice(0, 16))}</td>
    <td class="num">${U.num(a.score)}</td>
    <td>${a.passed ? L.badge('Lulus', 'good') : L.badge('Belum', 'bad')}</td>
  </tr>`).join('');

  const practicalRows = (practicals || []).map((p) => `<tr>
    <td>${U.h(String(p.created_at).slice(0, 16))}</td>
    <td class="num">${U.num(p.total)}</td>
    <td>${p.passed ? L.badge('Lulus', 'good') : L.badge('Belum', 'bad')}</td>
    <td>${p.critical_fail ? L.badge('Kritis gagal', 'bad') : '—'}</td>
    <td>${U.h(p.assessor || '—')}</td>
    <td>${U.h(p.note || '')}</td>
  </tr>`).join('');

  const body = `
    <div class="acad-hero">
      <div>
        <p class="acad-eyebrow">${U.h(TRACK_LABEL[course.track] || course.track)} · ${U.h(course.code)}</p>
        <h2>${U.h(course.title)}</h2>
        <p>${U.h(course.summary || '')}</p>
        <div class="chip-row">
          ${levelPill(course.level)}
          ${statusPill(enr ? enr.status : 'assigned')}
          ${L.badge(`${course.duration_min} menit`, 'muted')}
          ${L.badge(`v${course.version}`, 'muted')}
        </div>
      </div>
      <div class="acad-hero-side">
        <span class="acad-hero-label">Progres materi</span>
        <strong>${pct}%</strong>
        ${L.pbar(pct, 'indigo', 8)}
        <span class="hint-text">Milik: ${U.h(course.owner || '—')} · review ${U.h(course.review_date || '—')}</span>
      </div>
    </div>

    ${lastResult ? `<div class="flash flash-${lastResult.passed ? 'success' : 'error'}">
      ${L.icon(lastResult.passed ? 'check' : 'alert', 18)}
      <span>Skor ${U.num(lastResult.score)} dari ${lastResult.total} soal — ${lastResult.passed ? 'lulus teori' : `belum lulus (minimal ${course.pass_theory})`}.
      ${(lastResult.detail || []).filter((d) => !d.correct).map((d) => `<br>Soal ${d.id}: jawaban benar ${String.fromCharCode(65 + d.answer)}. ${U.h(d.why)}`).join('')}</span>
    </div>` : ''}

    <div class="grid grid-side">
      <div class="grid" style="gap:var(--gap-card)">
        ${L.card({ title: 'Kompetensi yang dicapai', subtitle: 'Learning objectives' }, `
          <ul class="acad-list">${(course.objectives || []).map((o) => `<li>${U.h(o)}</li>`).join('')}</ul>
          <div class="acad-block"><b>Mengapa penting</b><p>${U.h(course.relevance || '')}</p></div>
          ${(course.prerequisites || []).length ? `<div class="acad-block"><b>Prasyarat</b>
            <div class="chip-row">${course.prerequisites.map((c) => `<a class="badge badge-muted" href="${ctx.base}/academy/course/${U.h(c)}">${U.h(c)}</a>`).join('')}</div></div>` : ''}`)}

        ${L.card({ title: 'Materi pembelajaran', subtitle: `${doneCount}/${materials.length} bagian selesai` }, `
          ${materialsHtml || '<p class="hint-text">Belum ada materi.</p>'}
          ${canManage ? `<details class="disclosure acad-mat-add" ${materials.length ? '' : 'open'}>
            <summary>${L.icon('plus', 15)} Tambah materi (teks / video / PDF)</summary>
            <div class="disc-body">
              ${materialForm(ctx, { action: `${action}/material`, submitLabel: 'Tambah materi' })}
            </div>
          </details>` : ''}`)}

        ${L.card({ title: 'SOP / Job aid', subtitle: sop ? sop.title : 'Belum ada job aid' }, sop ? `
          <p class="hint-text">Kode dokumen ${U.h(sop.code)} · bisa dibuka saat bertugas di
            ${(docs || []).find((d) => d.code === sop.code)
              ? `<a href="${ctx.base}/academy/library/${docs.find((d) => d.code === sop.code).id}">pustaka (lengkap dengan lampiran)</a>`
              : `<a href="${ctx.base}/academy/library?q=${encodeURIComponent(sop.code)}">pustaka</a>`}.</p>
          <ul class="acad-list">${(sop.points || []).map((p) => `<li>${U.h(p)}</li>`).join('')}</ul>` : '<p class="hint-text">Belum ada job aid.</p>')}
      </div>

      <div class="grid" style="gap:var(--gap-card)">
        ${L.card({ title: 'Knowledge check', subtitle: `${questions.length} soal · lulus ${course.pass_theory}` }, quizHtml)}
        ${L.card({ title: 'Asesmen praktik', subtitle: `Rubrik berbobot · lulus ${course.pass_practical}${canAssess ? '' : ' (dinilai trainer)'}` }, `
          ${rubricHtml}
          ${canAssess ? `<div class="form-actions"><a class="btn btn-primary btn-sm" href="${ctx.base}/academy/assess?user=${learner ? learner.id : ''}&course=${U.h(course.code)}">${L.icon('check', 15)} Nilai praktik sekarang</a></div>` : ''}
          ${practicalRows ? `<div class="table-wrap" style="margin-top:var(--sp-3)"><table class="data">
            <thead><tr><th>Waktu</th><th class="num">Nilai</th><th>Hasil</th><th>Kritis</th><th>Penilai</th><th>Catatan</th></tr></thead>
            <tbody>${practicalRows}</tbody></table></div>` : '<p class="hint-text" style="margin-top:var(--sp-2)">Belum ada asesmen praktik.</p>'}`)}

        ${L.card({ title: 'Riwayat kuis', subtitle: 'Semua percobaan tercatat' }, attemptRows ? `
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Waktu</th><th class="num">Nilai</th><th>Hasil</th></tr></thead><tbody>${attemptRows}</tbody></table></div>` : '<p class="hint-text">Belum ada percobaan kuis.</p>')}

        ${L.card({ title: 'Syarat kelulusan (gate)', subtitle: `v${course.version} · ${course.owner || ''}` }, `
          <p class="acad-gate">${U.h(course.gate || 'Lulus teori dan praktik sesuai standar.')}</p>
          ${docs && docs.length ? `<p class="hint-text">Dokumen terkait: ${docs.map((d) => `<a href="${ctx.base}/academy/library/${d.id}">${U.h(d.code)}</a>`).join(', ')}</p>` : ''}`)}
      </div>
    </div>
  `;

  return L.shell(ctx, {
    title: course.title,
    subtitle: `${TRACK_LABEL[course.track] || course.track} · ${course.code}`,
    active: '/academy',
    content: body,
    toolbar: `<a class="btn btn-ghost btn-sm" href="${ctx.base}/academy">${L.icon('grid', 15)} Academy</a>`,
  });
}

// ---------------------------------------------------------------- learning path

function pathsPage(ctx, data) {
  const { paths, users, canAssess } = data;
  const userOptions = users.map((u) => `<option value="${u.id}">${U.h(u.name)} · ${U.h(u.job_title || u.role)}</option>`).join('');

  const body = `
    ${paths.map((p) => {
      const courses = p.courses.map((code) => {
        const c = curriculum.COURSES.find((x) => x.code === code) || {};
        return `<li><a href="${ctx.base}/academy/course/${U.h(code)}"><b>${U.h(code)}</b> ${U.h(c.title || '')}</a>
          <span class="hint-text">${U.h(LEVEL_LABEL[c.level] || '')} · ${c.duration || 30} menit</span></li>`;
      }).join('');
      return L.card({ title: p.name, subtitle: `${p.role_target || ''} · ${p.courses.length} modul` }, `
        <p class="hint-text" style="line-height:1.6">${U.h(p.description || '')}</p>
        <ol class="acad-pathlist">${courses}</ol>
        ${canAssess ? `<form method="post" action="${ctx.base}/academy/paths/${U.h(p.code)}/enroll" class="acad-enroll">
          <input type="hidden" name="_csrf" value="${ctx.csrf}">
          <input type="hidden" name="_back" value="/academy/paths">
          <label class="field"><span>Tugaskan ke</span><select name="user_id">${userOptions}</select></label>
          <label class="field"><span>Tenggat (hari)</span><input type="number" name="due_days" value="45" min="1" max="365"></label>
          <button class="btn btn-primary btn-sm" type="submit">Tugaskan jalur ini</button>
        </form>` : `<form method="post" action="${ctx.base}/academy/paths/${U.h(p.code)}/enroll">
          <input type="hidden" name="_csrf" value="${ctx.csrf}">
          <input type="hidden" name="_back" value="/academy/paths">
          <button class="btn btn-ghost btn-sm" type="submit">Tugaskan ke saya</button>
        </form>`}`);
    }).join('')}
  `;

  return L.shell(ctx, {
    title: 'Learning Path',
    subtitle: 'Urutan modul per jabatan — Foundation wajib untuk semua',
    active: '/academy',
    content: body,
  });
}

// ---------------------------------------------------------------- asesmen praktik

function assessPage(ctx, data) {
  const { users, selectedUser, course, rubric, learners } = data;
  const userOptions = users.map((u) => `<option value="${u.id}" ${Number(selectedUser) === u.id ? 'selected' : ''}>${U.h(u.name)} · ${U.h(u.job_title || u.role)}</option>`).join('');
  const courseOptions = curriculum.COURSES.map((c) => `<option value="${c.code}" ${course && course.code === c.code ? 'selected' : ''}>${c.code} · ${U.h(c.title)}</option>`).join('');

  const scoreSelect = (label) => `<select name="${U.h(label)}" class="acad-score">
    ${[0, 1, 2, 3, 4].map((v) => `<option value="${v}">${v} · ${['Belum kompeten', 'Developing', 'Cukup', 'Competent', 'Advanced'][v]}</option>`).join('')}
  </select>`;

  const body = `
    ${L.card({ title: 'Pilih peserta & modul', subtitle: 'Rubrik dinilai 0–4 per aspek, bobot dihitung otomatis' }, `
      <form method="get" action="${ctx.base}/academy/assess" class="acad-enroll">
        <label class="field"><span>Karyawan</span><select name="user">${userOptions}</select></label>
        <label class="field"><span>Modul</span><select name="course">${courseOptions}</select></label>
        <button class="btn btn-primary btn-sm" type="submit">Muat rubrik</button>
      </form>`)}

    ${course ? `<div class="grid grid-side">
      ${L.card({ title: `Rubrik — ${course.code}`, subtitle: `${course.title} · nilai lulus ${course.pass_practical}` }, `
        <form method="post" action="${ctx.base}/academy/assess" class="stack-form">
          <input type="hidden" name="_csrf" value="${ctx.csrf}">
          <input type="hidden" name="_back" value="/academy/assess?user=${Number(selectedUser) || ''}&course=${U.h(course.code)}">
          <input type="hidden" name="user_id" value="${Number(selectedUser) || ''}">
          <input type="hidden" name="course_code" value="${U.h(course.code)}">
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Aspek</th><th class="num">Bobot</th><th>Kritis</th><th>Skor (0–4)</th></tr></thead>
            <tbody>${rubric.map((r) => `<tr>
              <td>${U.h(r.aspect)}</td>
              <td class="num">${U.num(r.weight)}%</td>
              <td>${r.critical ? L.badge('Wajib', 'bad') : '—'}</td>
              <td>${scoreSelect(r.aspect)}</td>
            </tr>`).join('')}</tbody>
          </table></div>
          <label class="field"><span>Catatan untuk peserta</span><input name="note" placeholder="mis. perlu latihan distribusi bubuk"></label>
          <div class="form-actions"><button class="btn btn-primary" type="submit">Simpan hasil asesmen</button></div>
        </form>`)}

      ${L.card({ title: 'Panduan penilaian', subtitle: 'Skala 4 tingkat' }, `
        <ul class="acad-list">
          <li><b>0 — Belum kompeten:</b> belum mampu, berisiko pada kualitas/keselamatan.</li>
          <li><b>1 — Developing:</b> sebagian tugas, perlu arahan intensif.</li>
          <li><b>2 — Cukup:</b> mampu dengan pengawasan.</li>
          <li><b>3 — Competent:</b> mandiri sesuai standar.</li>
          <li><b>4 — Advanced:</b> konsisten dan mampu membimbing rekan.</li>
        </ul>
        <p class="hint-text">Aspek bertanda Wajib yang diberi skor 0 membuat peserta belum lulus, berapa pun nilai totalnya.</p>
        ${learners && learners.length ? `<div class="table-wrap" style="margin-top:var(--sp-3)"><table class="data">
          <thead><tr><th>Peserta</th><th>Modul</th><th class="num">Nilai</th><th>Hasil</th><th>Waktu</th></tr></thead>
          <tbody>${learners.map((l) => `<tr><td>${U.h(l.user_name)}</td><td>${U.h(l.code)}</td>
            <td class="num">${U.num(l.total)}</td><td>${l.passed ? L.badge('Lulus', 'good') : L.badge('Belum', 'bad')}</td>
            <td>${U.h(String(l.created_at).slice(0, 16))}</td></tr>`).join('')}</tbody>
        </table></div>` : ''}`)}
    </div>` : L.card({ title: 'Belum ada modul dipilih', subtitle: 'Pilih karyawan dan modul di atas' }, '<p class="hint-text">Rubrik praktik akan muncul di sini.</p>')}
  `;

  return L.shell(ctx, {
    title: 'Asesmen Praktik',
    subtitle: 'Trainer menilai checklist praktik dengan rubrik berbobot',
    active: '/academy',
    content: body,
  });
}

// ---------------------------------------------------------------- matriks & sertifikat

function matrixPage(ctx, data) {
  const { rows, levels, certificates, kpi } = data;
  const cell = (value) => {
    if (!value || value.total === 0) return '<span class="acad-cell is-empty">—</span>';
    const tone = value.complete ? 'is-full' : value.score >= 2 ? 'is-mid' : 'is-low';
    return `<span class="acad-cell ${tone}">${value.score}</span>
      <span class="acad-cell-sub">${value.done}/${value.total}</span>`;
  };

  const body = `
    <div class="grid grid-4">
      ${[
        ['Karyawan terdaftar', U.num(kpi.learners), 'dalam cakupan Anda'],
        ['Penyelesaian modul', U.pct(kpi.completion, 0), `${kpi.completed}/${kpi.assigned} penugasan`],
        ['Sertifikat aktif', U.num(kpi.certificates), `cakupan ${U.pct(kpi.certificateCoverage, 0)}`],
        ['Terlambat', U.num(kpi.overdue), 'modul melewati tenggat'],
      ].map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value">${value}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    ${L.card({ title: 'Matriks kompetensi', subtitle: 'Skor 0–4 per level · angka kecil = modul lulus/total' }, `
      <div class="table-wrap"><table class="data acad-matrix">
        <thead><tr><th>Karyawan</th>${levels.map((l) => `<th class="num">${U.h(LEVEL_LABEL[l] || l)}</th>`).join('')}<th class="num">Sertifikat</th></tr></thead>
        <tbody>${rows.map((r) => `<tr>
          <td><span class="strong">${U.h(r.user.name)}</span><span class="sub-cell">${U.h(r.user.job_title || r.user.role)} · ${U.h(r.user.company || '—')}</span></td>
          ${levels.map((l) => `<td class="num acad-matrix-cell">${cell(r.levels[l])}</td>`).join('')}
          <td class="num">${r.certs.length ? r.certs.map((l) => L.badge(l, 'good')).join(' ') : '<span class="hint-text">—</span>'}</td>
        </tr>`).join('') || `<tr><td colspan="${levels.length + 2}">${L.empty('Belum ada karyawan dalam cakupan')}</td></tr>`}</tbody>
      </table></div>
      <p class="hint-text">Skor: 4 = seluruh modul level lulus · 3 = sebagian besar lulus dengan nilai praktik tinggi · 1–2 = sedang berjalan · 0 = ditugaskan belum mulai. Penugasan kerja harus mengikuti kompetensi yang sudah terbukti.</p>`)}

    ${L.card({ title: 'Register sertifikasi', subtitle: `${certificates.length} sertifikat internal` }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Kode</th><th>Karyawan</th><th>Level</th><th>Terbit</th><th>Berlaku sampai</th><th>Status</th></tr></thead>
        <tbody>${certificates.map((c) => `<tr>
          <td><span class="strong">${U.h(c.code)}</span><span class="sub-cell">${U.h(TRACK_LABEL[c.track] || c.track)}</span></td>
          <td>${U.h(c.user_name)}</td>
          <td>${levelPill(c.level)}</td>
          <td>${U.h(String(c.issued_at).slice(0, 10))}</td>
          <td>${U.h(c.expires_at || '—')}</td>
          <td>${L.badge(c.status, c.status === 'active' ? 'good' : 'muted')}</td>
        </tr>`).join('') || `<tr><td colspan="6">${L.empty('Belum ada sertifikat diterbitkan')}</td></tr>`}</tbody>
      </table></div>`)}
  `;

  return L.shell(ctx, {
    title: 'Matriks Kompetensi & Sertifikasi',
    subtitle: 'Siapa yang boleh bekerja mandiri, siapa yang siap dipromosikan',
    active: '/academy',
    content: body,
  });
}

// ---------------------------------------------------------------- pustaka SOP & resep

/**
 * Form dokumen pustaka (SOP / job aid / recipe). Dipakai untuk membuat dokumen baru
 * maupun mengubah dokumen yang sudah ada — termasuk dokumen hasil seed kurikulum.
 */
function docForm(ctx, { doc, courses = [], docKinds = {}, action, submitLabel = 'Simpan dokumen', compact = false }) {
  const d = doc || { kind: 'sop', code: '', title: '', version: '1.0', status: 'draft', owner: '', summary: '', body: '', effective_date: '' };
  const kinds = Object.entries(docKinds)
    .map(([key, meta]) => `<option value="${key}" ${d.kind === key ? 'selected' : ''}>${U.h(meta.label)}</option>`).join('');
  const courseOptions = courses.map((c) => `<option value="${U.h(c.code)}" ${d.course_code === c.code ? 'selected' : ''}>${U.h(c.code)} · ${U.h(c.title)}</option>`).join('');
  return `<form method="post" action="${action}" class="stack-form acad-doc-form">
    <input type="hidden" name="_csrf" value="${ctx.csrf}">
    <div class="form-grid" style="gap:10px">
      <label class="field"><span>Jenis dokumen</span>
        <select name="kind">${kinds}</select>
      </label>
      <label class="field"><span>Kode dokumen</span>
        <input name="code" value="${U.h(d.code || '')}" maxlength="40" required placeholder="mis. SOP-BAR-GRINDER">
      </label>
      <label class="field"><span>Judul</span>
        <input name="title" value="${U.h(d.title || '')}" maxlength="160" required>
      </label>
      <label class="field"><span>Versi</span>
        <input name="version" value="${U.h(d.version || '1.0')}" maxlength="20">
      </label>
      <label class="field"><span>Pemilik / penanggung jawab</span>
        <input name="owner" value="${U.h(d.owner || '')}" maxlength="120" placeholder="mis. Head Barista">
      </label>
      <label class="field"><span>Berlaku sejak</span>
        <input name="effective_date" type="date" value="${U.h(String(d.effective_date || '').slice(0, 10))}">
      </label>
      <label class="field"><span>Status</span>
        <select name="status">
          ${['draft', 'review', 'published', 'archived'].map((st) => `<option value="${st}" ${d.status === st ? 'selected' : ''}>${st}</option>`).join('')}
        </select>
      </label>
      <label class="field"><span>Modul terkait (opsional)</span>
        <select name="course_code">
          <option value="">— tidak terkait modul —</option>
          ${courseOptions}
        </select>
      </label>
    </div>
    <label class="field"><span>Ringkasan singkat</span>
      <input name="summary" value="${U.h(d.summary || '')}" maxlength="400" placeholder="Satu kalimat: dokumen ini dipakai untuk apa">
    </label>
    <label class="field"><span>Isi dokumen (langkah / job aid)</span>
      <textarea name="body" rows="${compact ? 5 : 10}" placeholder="1) …&#10;2) …&#10;3) …">${U.h(d.body || '')}</textarea>
    </label>
    <div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">${U.h(submitLabel)}</button></div>
  </form>`;
}

/** Satu lampiran: embed video / pratinjau PDF + kontrol ubah bila pengguna berhak. */
function attachmentBlock(ctx, { attachment: a, index, total, canManage, docId }) {
  const kindMeta = video.KINDS[a.kind === 'video' ? 'video' : 'pdf'];
  let media;
  if (a.kind === 'video') {
    const v = video.prepare('video', a.url);
    media = v.ok ? `<div class="acad-embed" data-embed="video" data-provider="${U.h(a.provider || v.provider)}">
        <iframe src="${U.h(v.embedUrl)}" title="${U.h(a.title)}" loading="lazy" allowfullscreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerpolicy="strict-origin-when-cross-origin"></iframe>
      </div>
      <p class="hint-text">Video diputar dari ${U.h(v.label)} — bukan dari server aplikasi.
        <a href="${U.h(v.openUrl)}" target="_blank" rel="noopener noreferrer">Buka di tab baru</a>
        ${a.duration_min ? `· estimasi ${U.num(a.duration_min)} menit` : ''}</p>`
      : `<p class="hint-text">${U.h(v.error)}</p>`;
  } else {
    const d = video.prepare('pdf', a.url);
    const frame = d.ok && d.inline
      ? `<div class="acad-embed acad-embed-doc" data-embed="pdf" data-provider="${U.h(a.provider || d.provider)}">
          <iframe src="${U.h(d.embedUrl)}" title="${U.h(a.title)}" loading="lazy"></iframe>
        </div>`
      : `<p class="hint-text">Dokumen dari ${U.h(d.ok ? d.label : 'tautan')} dibuka di tab baru agar tetap aman.</p>`;
    media = `${frame}
      <div class="form-actions">
        <a class="btn btn-ghost btn-sm" href="${U.h(d.ok ? d.openUrl : a.url)}" target="_blank" rel="noopener noreferrer">${L.icon('download', 14)} Buka dokumen PDF</a>
      </div>`;
  }

  const editForm = canManage ? `<details class="disclosure acad-mat-edit">
      <summary>${L.icon('settings', 14)} Ubah lampiran ini</summary>
      <div class="disc-body">
        <form method="post" action="${ctx.base}/academy/library/attachment/${a.id}" class="stack-form">
          <input type="hidden" name="_csrf" value="${ctx.csrf}">
          <input type="hidden" name="doc_id" value="${docId}">
          <div class="form-grid" style="gap:10px">
            <label class="field"><span>Jenis lampiran</span>
              <select name="kind">
                ${Object.entries(video.KINDS).filter(([k]) => k !== 'text')
    .map(([k, meta]) => `<option value="${k}" ${a.kind === k ? 'selected' : ''}>${U.h(meta.label)}</option>`).join('')}
              </select>
            </label>
            <label class="field"><span>Judul lampiran</span>
              <input name="title" value="${U.h(a.title || '')}" maxlength="160" required>
            </label>
            <label class="field"><span>Durasi (menit)</span>
              <input name="duration_min" type="number" min="0" max="600" value="${Number(a.duration_min) || 0}">
            </label>
          </div>
          <label class="field"><span>URL video / PDF</span>
            <input name="url" value="${U.h(a.url || '')}" required>
          </label>
          <div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">Simpan lampiran</button></div>
        </form>
        <div class="form-actions" style="margin-top:var(--sp-2)">
          <form method="post" action="${ctx.base}/academy/library/attachment/${a.id}/move" style="display:inline">
            <input type="hidden" name="_csrf" value="${ctx.csrf}">
            <input type="hidden" name="direction" value="up">
            <button class="btn btn-ghost btn-sm" type="submit" ${index === 0 ? 'disabled' : ''}>↑ Naik</button>
          </form>
          <form method="post" action="${ctx.base}/academy/library/attachment/${a.id}/move" style="display:inline">
            <input type="hidden" name="_csrf" value="${ctx.csrf}">
            <input type="hidden" name="direction" value="down">
            <button class="btn btn-ghost btn-sm" type="submit" ${index === total - 1 ? 'disabled' : ''}>↓ Turun</button>
          </form>
          <form method="post" action="${ctx.base}/academy/library/attachment/${a.id}/delete" data-confirm="Hapus lampiran ${U.h(a.title)}?">
            <input type="hidden" name="_csrf" value="${ctx.csrf}">
            <button class="btn btn-danger btn-sm" type="submit">Hapus lampiran</button>
          </form>
        </div>
      </div>
    </details>` : '';

  return `<article class="acad-material" data-attachment="${a.id}" data-kind="${U.h(a.kind)}">
    <header>
      <div><span class="acad-mat-num">${index + 1}</span> <strong>${U.h(a.title)}</strong>
        <span class="acad-mat-media">${L.icon(kindMeta.icon, 13)} ${U.h(kindMeta.label)}</span></div>
      ${a.duration_min ? `<span class="hint-text">${U.num(a.duration_min)} menit</span>` : ''}
    </header>
    ${media}
    ${editForm}
  </article>`;
}

function libraryPage(ctx, data) {
  const { docs, filter, canManage, courses = [], docKinds = {}, docStatus = [] } = data;
  const statusLabel = (status) => ({ draft: 'Draft', review: 'Review', published: 'Terbit', archived: 'Arsip' }[status] || status);
  const statusTone = (status) => ({ draft: 'muted', review: 'warn', published: 'good', archived: 'muted' }[status] || 'muted');
  const kindLabel = (kind) => (docKinds[kind] ? docKinds[kind].label : kind === 'recipe' ? 'Recipe master' : 'SOP / Job aid');

  const cards = docs.map((d) => `<article class="acad-doc">
    <header>
      <div>
        <span class="acad-doc-kind">${U.h(kindLabel(d.kind))}${d.source === 'custom' ? ' · buatan sendiri' : ''}</span>
        <h3>${U.h(d.title)}</h3>
        <p class="hint-text">${U.h(d.code)} · v${U.h(d.version)} · ${U.h(d.owner || '')} · berlaku ${U.h(d.effective_date || '—')}</p>
      </div>
      ${L.badge(statusLabel(d.status), statusTone(d.status))}
    </header>
    ${d.summary ? `<p class="acad-doc-summary">${U.h(d.summary)}</p>` : ''}
    ${d.attachments && d.attachments.total ? `<div class="badge-row">
      ${d.attachments.video ? L.badge(`${d.attachments.video} video`, 'indigo') : ''}
      ${d.attachments.pdf ? L.badge(`${d.attachments.pdf} PDF`, 'warn') : ''}
    </div>` : '<p class="hint-text">Belum ada lampiran video/PDF.</p>'}
    <details class="disclosure">
      <summary>${L.icon('receipt', 15)} Buka isi dokumen</summary>
      <div class="disc-body"><pre class="acad-doc-body">${U.h(d.body || '')}</pre></div>
    </details>
    <div class="form-actions">
      <a class="btn btn-ghost btn-sm" href="${ctx.base}/academy/library/${d.id}">${L.icon('box', 14)} Detail &amp; lampiran</a>
      ${d.course_code ? `<a class="btn btn-ghost btn-sm" href="${ctx.base}/academy/course/${U.h(d.course_code)}">${L.icon('coffee', 14)} ${U.h(d.course_code)}</a>` : ''}
    </div>
    ${canManage ? `<form method="post" action="${ctx.base}/academy/library/${d.id}/status" class="acad-doc-actions">
      <input type="hidden" name="_csrf" value="${ctx.csrf}">
      <input type="hidden" name="_back" value="/academy/library">
      <select name="status">
        ${(docStatus.length ? docStatus : ['draft', 'review', 'published', 'archived']).map((s) => `<option value="${s}" ${d.status === s ? 'selected' : ''}>${statusLabel(s)}</option>`).join('')}
      </select>
      <button class="btn btn-ghost btn-sm" type="submit">Ubah status</button>
    </form>` : ''}
  </article>`).join('');

  const createCard = canManage ? L.card({
    title: 'Dokumen baru',
    subtitle: 'Buat SOP / job aid sendiri, lalu lampirkan video atau PDF',
  }, `<details class="disclosure acad-mat-add">
      <summary>${L.icon('plus', 15)} Tambah dokumen SOP / job aid</summary>
      <div class="disc-body">${docForm(ctx, { courses, docKinds, action: `${ctx.base}/academy/library`, submitLabel: 'Buat dokumen', compact: true })}</div>
    </details>`) : '';

  const body = `
    ${createCard}
    ${L.card({ title: 'Pustaka SOP & Recipe Master', subtitle: `${docs.length} dokumen · job aid bisa dibuka saat bertugas` }, `
      <form method="get" action="${ctx.base}/academy/library" class="acad-enroll">
        <label class="field"><span>Cari</span><input name="q" value="${U.h(filter.q || '')}" placeholder="kode atau kata kunci"></label>
        <label class="field"><span>Jenis</span>
          <select name="kind">
            <option value="">Semua</option>
            ${Object.entries(docKinds).map(([k, meta]) => `<option value="${k}" ${filter.kind === k ? 'selected' : ''}>${U.h(meta.label)}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Status</span>
          <select name="status">
            <option value="">Semua</option>
            ${(docStatus.length ? docStatus : ['draft', 'review', 'published', 'archived'])
    .map((s) => `<option value="${s}" ${filter.status === s ? 'selected' : ''}>${statusLabel(s)}</option>`).join('')}
          </select>
        </label>
        <button class="btn btn-primary btn-sm" type="submit">Terapkan</button>
      </form>
      <div class="acad-doc-grid">${cards || L.empty('Tidak ada dokumen yang cocok')}</div>`)}
  `;

  return L.shell(ctx, {
    title: 'Pustaka SOP & Resep',
    subtitle: 'Satu sumber standar operasional dan kartu resep',
    active: '/academy',
    content: body,
    toolbar: canManage ? `<span class="hint-text">Dokumen bisa diubah & dilampiri video/PDF</span>` : '',
  });
}

// ---------------------------------------------------------------- detail dokumen

function docPage(ctx, data) {
  const { doc, attachments, course, canManage, docKinds, docStatus, courses } = data;
  const statusLabel = (status) => ({ draft: 'Draft', review: 'Review', published: 'Terbit', archived: 'Arsip' }[status] || status);
  const statusTone = (status) => ({ draft: 'muted', review: 'warn', published: 'good', archived: 'muted' }[status] || 'muted');
  const kindLabel = docKinds[doc.kind] ? docKinds[doc.kind].label : doc.kind;

  const attachmentHtml = attachments.length
    ? attachments.map((a, i) => attachmentBlock(ctx, { attachment: a, index: i, total: attachments.length, canManage, docId: doc.id })).join('')
    : `<p class="hint-text">Belum ada lampiran. Lampirkan video prosedur (YouTube/Vimeo) atau PDF (Google Drive/tautan langsung) agar job aid bisa dibuka langsung dari ponsel saat bertugas.</p>`;

  const addAttachment = canManage ? L.card({
    title: 'Tambah lampiran',
    subtitle: 'Video embed atau PDF — hanya URL yang disimpan, tidak ada file di server',
  }, `<form method="post" action="${ctx.base}/academy/library/${doc.id}/attachment" class="stack-form">
      <input type="hidden" name="_csrf" value="${ctx.csrf}">
      <div class="form-grid" style="gap:10px">
        <label class="field"><span>Jenis lampiran</span>
          <select name="kind">
            <option value="video">Video</option>
            <option value="pdf" selected>Dokumen PDF</option>
          </select>
        </label>
        <label class="field"><span>Judul lampiran</span>
          <input name="title" maxlength="160" placeholder="mis. Video: cara backflush mesin">
        </label>
        <label class="field"><span>Durasi (menit, opsional)</span>
          <input name="duration_min" type="number" min="0" max="600" value="0">
        </label>
      </div>
      <label class="field"><span>URL video / PDF</span>
        <input name="url" required placeholder="https://youtu.be/… · https://vimeo.com/… · https://drive.google.com/file/d/…/view">
      </label>
      <p class="hint-text">YouTube &amp; Vimeo otomatis diubah ke mode embed. Link Google Drive otomatis memakai mode pratinjau.
        URL https lain dipasang sebagai embed bebas.</p>
      <div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">${L.icon('plus', 14)} Lampirkan</button></div>
    </form>`) : '';

  const editCard = canManage ? L.card({
    title: 'Ubah dokumen',
    subtitle: 'Kode, judul, isi, pemilik, versi, status, dan modul terkait',
  }, docForm(ctx, { doc, courses, docKinds, action: `${ctx.base}/academy/library/${doc.id}`, submitLabel: 'Simpan perubahan' })) : '';

  const body = `
    ${L.card({ title: doc.title, subtitle: `${U.h(doc.code)} · v${U.h(doc.version)} · ${U.h(kindLabel)}${doc.source === 'custom' ? ' · buatan sendiri' : ' · dari kurikulum'}` }, `
      <div class="acad-doc-head">
        ${L.badge(statusLabel(doc.status), statusTone(doc.status))}
        <span class="hint-text">Pemilik ${U.h(doc.owner || '—')} · berlaku ${U.h(doc.effective_date || '—')}
          · diperbarui ${U.h(String(doc.updated_at || doc.created_at || '').slice(0, 16))}</span>
      </div>
      ${doc.summary ? `<p class="acad-doc-summary">${U.h(doc.summary)}</p>` : ''}
      <pre class="acad-doc-body is-open">${U.h(doc.body || '')}</pre>
      <div class="form-actions">
        ${course ? `<a class="btn btn-ghost btn-sm" href="${ctx.base}/academy/course/${U.h(course.code)}">${L.icon('coffee', 14)} Modul ${U.h(course.code)}</a>` : ''}
        <a class="btn btn-ghost btn-sm" href="${ctx.base}/academy/library">${L.icon('receipt', 14)} Pustaka</a>
      </div>`)}

    ${L.card({ title: 'Lampiran video & PDF', subtitle: `${attachments.length} lampiran` }, attachmentHtml)}

    ${addAttachment}
    ${editCard}

    ${canManage ? L.card({ title: 'Status & hapus', subtitle: 'Dokumen dari kurikulum tidak bisa dihapus (arsipkan saja)' }, `
      <div class="form-actions">
        <form method="post" action="${ctx.base}/academy/library/${doc.id}/status">
          <input type="hidden" name="_csrf" value="${ctx.csrf}">
          <input type="hidden" name="_back" value="/academy/library/${doc.id}">
          <select name="status">
            ${(docStatus || []).map((s) => `<option value="${s}" ${doc.status === s ? 'selected' : ''}>${statusLabel(s)}</option>`).join('')}
          </select>
          <button class="btn btn-ghost btn-sm" type="submit">Ubah status</button>
        </form>
        ${doc.source === 'custom' ? `<form method="post" action="${ctx.base}/academy/library/${doc.id}/delete" data-confirm="Hapus dokumen ${U.h(doc.code)} beserta lampirannya?">
          <input type="hidden" name="_csrf" value="${ctx.csrf}">
          <button class="btn btn-danger btn-sm" type="submit">Hapus dokumen</button>
        </form>` : `<span class="hint-text">${U.h(doc.code)} berasal dari kurikulum — ubah saja isinya, atau arsipkan.</span>`}
      </div>`) : ''}
  `;

  return L.shell(ctx, {
    title: doc.title,
    subtitle: `Pustaka · ${doc.code}`,
    active: '/academy',
    content: body,
    toolbar: `<a class="btn btn-ghost btn-sm" href="${ctx.base}/academy/library">${L.icon('receipt', 15)} Pustaka</a>`,
  });
}

// ---------------------------------------------------------------- kelola kurikulum

function managePage(ctx, data) {
  const { courses, stats, docsPending } = data;
  const body = `
    <div class="grid grid-4">
      ${[
        ['Modul', U.num(stats.total), `${stats.published} terbit · ${stats.review} review`],
        ['Soal kuis', U.num(stats.questions), 'di seluruh modul'],
        ['Pustaka', U.num(stats.docs), `${docsPending} menunggu review`],
        ['Rata-rata durasi', `${U.num(stats.avgDuration)} mnt`, 'per modul'],
      ].map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value">${value}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    ${L.card({ title: 'Alur persetujuan materi', subtitle: 'Materi berisiko tidak boleh terbit tanpa verifikasi' }, `
      <ol class="acad-list">
        <li>Identifikasi kebutuhan training (audit kompetensi & keluhan pelanggan).</li>
        <li>Penyusunan materi oleh trainer (12 komponen wajib per modul).</li>
        <li>Pemeriksaan SOP dan standar produk oleh penanggung jawab.</li>
        <li>Uji coba materi di operasional (satu shift atau satu outlet).</li>
        <li>Persetujuan penanggung jawab → status <b>published</b>.</li>
        <li>Penugasan ke karyawan melalui learning path.</li>
        <li>Assessment dan pencatatan hasil (kuis + praktik).</li>
        <li>Evaluasi efektivitas setiap triwulan (lihat KPI di dashboard).</li>
      </ol>
      <p class="hint-text">Untuk resep, standar keamanan pangan, dan SOP keselamatan: jangan terbitkan sebelum diverifikasi trainer kompeten.</p>`)}

    ${L.card({ title: 'Master kurikulum', subtitle: `${courses.length} modul — ubah status, ambang nilai, versi` }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Kode</th><th>Modul</th><th>Jalur</th><th>Level</th><th class="num">Kuis</th><th class="num">Durasi</th><th>Status</th><th>Ambang & versi</th></tr></thead>
        <tbody>${courses.map((c) => `<tr>
          <td><a class="strong" href="${ctx.base}/academy/course/${U.h(c.code)}">${U.h(c.code)}</a></td>
          <td><span class="sub-cell" style="margin-top:0">${U.h(c.title)}</span></td>
          <td>${L.badge(TRACK_LABEL[c.track] || c.track, TRACK_TONE[c.track] || 'muted')}</td>
          <td>${U.h(c.level)}</td>
          <td class="num">${U.num(c.quiz_count)}</td>
          <td class="num">${U.num(c.duration_min)} mnt</td>
          <td>${L.badge(c.status, c.status === 'published' ? 'good' : c.status === 'review' ? 'warn' : 'muted')}</td>
          <td>
            <form method="post" action="${ctx.base}/academy/manage/course/${c.id}" class="acad-inline-form">
              <input type="hidden" name="_csrf" value="${ctx.csrf}">
              <input type="hidden" name="_back" value="/academy/manage">
              <input name="pass_theory" type="number" min="0" max="100" value="${c.pass_theory}" title="Ambang teori">
              <input name="pass_practical" type="number" min="0" max="100" value="${c.pass_practical}" title="Ambang praktik">
              <input name="version" value="${U.h(c.version)}" title="Versi" style="width:70px">
              <select name="status" title="Status">
                ${['published', 'review', 'draft', 'archived'].map((s) => `<option value="${s}" ${c.status === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
              <button class="btn btn-ghost btn-sm" type="submit">Simpan</button>
            </form>
          </td>
        </tr>`).join('')}</tbody>
      </table></div>`)}
  `;

  return L.shell(ctx, {
    title: 'Kelola Kurikulum Academy',
    subtitle: 'Master modul, ambang kelulusan, versi, dan status publikasi',
    active: '/academy',
    content: body,
  });
}

module.exports = { academyPage, coursePage, pathsPage, assessPage, matrixPage, libraryPage, docPage, managePage };
