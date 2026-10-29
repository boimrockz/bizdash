'use strict';

const U = require('../lib/util');
const L = require('./layout');
const { ROLE_LABELS, can } = require('../lib/auth');

const LEVEL_LABEL = { holding: 'Holding', unit: 'Unit usaha', outlet: 'Cabang / Outlet' };
const LEVEL_RANK = { holding: 0, unit: 1, outlet: 2 };
// Jenjang jabatan → jalur belajar Leadership Academy (lihat lib/lms/curriculum-leadership.js).
// Dipakai di kartu jabatan supaya terlihat bekal belajar yang menempel pada tiap jenjang.
const LEADERSHIP_PATH = {
  supervisor: 'Supervisor (S1)',
  manager: 'Manajer (M2)',
  director: 'Direktur & Chief (E3)',
  owner: 'Direktur & Chief (E3)',
};

const POS_LEVEL_LABEL = {
  owner: 'Owner', director: 'Direktur', manager: 'Manajer', supervisor: 'Supervisor', staff: 'Staff',
};

function initialsAvatar(user, size = 28) {
  const url = String(user.photo_url || '');
  if (/^https?:\/\//i.test(url)) {
    return `<span class="avatar sm" style="width:${size}px;height:${size}px"><img src="${U.h(url)}" alt="" loading="lazy"></span>`;
  }
  return `<span class="avatar sm" style="width:${size}px;height:${size}px">${U.h(U.initials(user.name))}</span>`;
}

function companySelect(ctx, companies, selectedId, excludeIds = new Set(), allowEmpty = true) {
  const options = companies
    .filter((c) => !excludeIds.has(c.id))
    .map((c) => `<option value="${c.id}" ${Number(selectedId) === c.id ? 'selected' : ''}>${U.h('— '.repeat(LEVEL_RANK[c.level] || 0))}${U.h(c.name)}</option>`)
    .join('');
  return `${allowEmpty ? '<option value="">— tanpa induk —</option>' : ''}${options}`;
}

function companyRows(ctx, data) {
  const { tree, canWrite, canMove, byId } = data;
  return tree.map((node) => {
    const c = node.company;
    const editForm = canWrite ? `
      <details class="disclosure" style="border:none;background:transparent">
        <summary style="padding:0;font-size:11.5px;font-weight:600;color:var(--indigo)">Ubah</summary>
        <div class="disc-body" style="padding:10px 0;min-width:340px">
          <form method="post" action="${ctx.base}/structure/company/save">
            ${ctx.csrfField}${ctx.backField}
            <input type="hidden" name="id" value="${c.id}">
            <div class="form-grid" style="gap:8px">
              <label class="field"><span>Nama</span><input name="name" value="${U.h(c.name)}" required></label>
              <label class="field"><span>Kode</span><input name="code" value="${U.h(c.code || '')}" placeholder="mis. KMG"></label>
              <label class="field"><span>Tingkat</span>
                <select name="level">${Object.entries(LEVEL_LABEL).map(([k, v]) => `<option value="${k}" ${c.level === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
              </label>
              <label class="field"><span>Jenis</span>
                <select name="kind">
                  ${['outlet', 'roastery', 'kitchen', 'office', 'warehouse'].map((k) => `<option value="${k}" ${c.kind === k ? 'selected' : ''}>${U.h(k)}</option>`).join('')}
                </select>
              </label>
              ${canMove ? `<label class="field"><span>Induk</span>
                <select name="parent_id">${companySelect(ctx, data.companies, c.parent_id, data.descendantIdsOf(c.id))}</select>
              </label>` : ''}
              <label class="field"><span>Telepon</span><input name="phone" value="${U.h(c.phone || '')}"></label>
              <label class="field"><span>Urutan</span><input name="sort_order" type="number" step="1" value="${c.sort_order || 0}"></label>
            </div>
            <label class="field" style="margin-top:8px"><span>Alamat</span><input name="address" value="${U.h(c.address || '')}"></label>
            <p class="form-section">Asal pengiriman (dipakai saat cek ongkir & buat resi)</p>
            <div class="form-grid" style="gap:8px">
              <label class="field"><span>Kecamatan / area asal</span><input name="origin_area" value="${U.h(c.origin_area || '')}" placeholder="mis. Kemang"></label>
              <label class="field"><span>Kota asal</span><input name="origin_city" value="${U.h(c.origin_city || '')}" placeholder="mis. Jakarta Selatan"></label>
              <label class="field"><span>Kode pos</span><input name="origin_zip" value="${U.h(c.origin_zip || '')}" placeholder="12730"></label>
              <label class="field"><span>Telepon gudang/pengirim</span><input name="origin_phone" value="${U.h(c.origin_phone || '')}" placeholder="08xxxxxxxxxx"></label>
            </div>
            <div class="form-actions" style="margin-top:8px">
              <button class="btn btn-primary btn-sm" type="submit">Simpan</button>
            </div>
          </form>
          ${c.parent_id ? `<form method="post" action="${ctx.base}/structure/company/${c.id}/delete" data-confirm="Hapus ${U.h(c.name)}? Pastikan tidak ada cabang, pengguna, atau transaksi." style="margin-top:6px">
            ${ctx.csrfField}${ctx.backField}
            <button class="btn btn-danger btn-sm" type="submit">Hapus entitas</button>
          </form>` : `<p class="hint-text" style="margin-top:6px">Entitas induk utama tidak dapat dihapus.</p>`}
        </div>
      </details>` : '';

    return `<tr class="tree-row level-${c.level}">
      <td>
        <div class="tree-cell" style="padding-left:${node.depth * 22}px">
          ${node.depth ? '<span class="tree-line"></span>' : ''}
          <span class="tree-dot level-${c.level}"></span>
          <div>
            <span class="strong">${U.h(c.name)}</span>
            <span class="sub-cell">${U.h(c.code || '—')} · ${U.h(LEVEL_LABEL[c.level] || c.level)}${c.address ? ' · ' + U.h(c.address) : ''}${c.origin_area ? ' · asal kirim ' + U.h(c.origin_area) : ''}</span>
          </div>
        </div>
      </td>
      <td class="num">${node.outlets}</td>
      <td class="num">${node.users}</td>
      <td class="num">${node.positions}</td>
      <td class="num">${node.revenue ? U.idrShort(node.revenue) : '—'}</td>
      <td class="num">${editForm}</td>
    </tr>`;
  }).join('');
}

function positionCards(ctx, data) {
  const { positions, byCompany, companyMap, canWrite, usersByPosition } = data;
  const groups = [...byCompany.entries()]
    .map(([companyId, list]) => ({ company: companyMap.get(companyId), list }))
    .filter((g) => g.company)
    .sort((a, b) => (LEVEL_RANK[a.company.level] - LEVEL_RANK[b.company.level]) || a.company.id - b.company.id);

  return groups.map((g) => `<div class="pos-group">
    <div class="pos-group-head">
      <span class="tree-dot level-${g.company.level}"></span>
      <h4>${U.h(g.company.name)}</h4>
      <span class="hint-text">${g.list.length} jabatan</span>
    </div>
    <div class="pos-grid">
      ${g.list.map((p) => {
        const members = usersByPosition.get(p.id) || [];
        const parent = p.parent_id ? data.positionMap.get(p.parent_id) : null;
        return `<article class="pos-card level-${p.level}">
          <div class="pos-card-top">
            <span class="pos-level">${U.h(POS_LEVEL_LABEL[p.level] || p.level)}</span>
            ${p.active ? '' : L.badge('Nonaktif', 'muted')}
          </div>
          <h5>${U.h(p.name)}</h5>
          ${parent ? `<p class="pos-parent">Melapor ke ${U.h(parent.name)}</p>` : '<p class="pos-parent">Puncak struktur</p>'}
          ${LEADERSHIP_PATH[p.level] ? `<a class="pos-path" href="${ctx.base}/academy/paths">${L.icon('target', 13)} Jalur belajar ${U.h(LEADERSHIP_PATH[p.level])}</a>` : ''}
          <div class="pos-members">
            ${members.length
              ? members.map((u) => `<a class="pos-member" href="${ctx.base}/profile?user=${u.id}">${initialsAvatar(u, 24)}<span>${U.h(u.name)}</span></a>`).join('')
              : '<span class="pos-empty">Belum ada pemegang jabatan</span>'}
          </div>
          ${canWrite ? `<details class="disclosure" style="border:none;background:transparent;margin-top:6px">
            <summary style="padding:0;font-size:11px;font-weight:600;color:var(--indigo)">Ubah jabatan</summary>
            <div class="disc-body" style="padding:8px 0">
              <form method="post" action="${ctx.base}/structure/position/save">
                ${ctx.csrfField}${ctx.backField}
                <input type="hidden" name="id" value="${p.id}">
                <div class="form-grid" style="gap:6px">
                  <label class="field"><span>Nama jabatan</span><input name="name" value="${U.h(p.name)}" required></label>
                  <label class="field"><span>Tingkat</span>
                    <select name="level">${Object.entries(POS_LEVEL_LABEL).map(([k, v]) => `<option value="${k}" ${p.level === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
                  </label>
                  <label class="field"><span>Entitas</span>
                    <select name="company_id">${companySelect(ctx, data.companies, p.company_id, new Set(), false)}</select>
                  </label>
                  <label class="field"><span>Atasan jabatan</span>
                    <select name="parent_id">
                      <option value="">— puncak —</option>
                      ${data.positions.filter((o) => o.id !== p.id).map((o) => `<option value="${o.id}" ${p.parent_id === o.id ? 'selected' : ''}>${U.h(o.name)} · ${U.h(data.companyMap.get(o.company_id) ? data.companyMap.get(o.company_id).name : '')}</option>`).join('')}
                    </select>
                  </label>
                  <label class="field"><span>Urutan</span><input name="sort_order" type="number" step="1" value="${p.sort_order || 0}"></label>
                </div>
                <div class="form-actions" style="margin-top:8px">
                  <button class="btn btn-primary btn-sm" type="submit">Simpan</button>
                </div>
              </form>
              <form method="post" action="${ctx.base}/structure/position/${p.id}/delete" data-confirm="Hapus jabatan ${U.h(p.name)}?" style="margin-top:6px">
                ${ctx.csrfField}${ctx.backField}
                <button class="btn btn-danger btn-sm" type="submit">Hapus</button>
              </form>
            </div>
          </details>` : ''}
        </article>`;
      }).join('')}
    </div>
  </div>`).join('');
}

function peopleRows(ctx, data) {
  const { people, positions, canWrite, users } = data;
  return people.map((u) => `<tr>
    <td>
      <div class="person-cell">${initialsAvatar(u, 30)}
        <div><a class="strong" href="${ctx.base}/profile?user=${u.id}">${U.h(u.name)}</a>
        <span class="sub-cell">${U.h(u.email)}</span></div>
      </div>
    </td>
    <td>${U.h(u.company_name || '—')}</td>
    <td>${L.badge(ROLE_LABELS[u.role] || u.role, u.role === 'owner' ? 'indigo' : 'muted')}</td>
    <td class="num">${canWrite ? `<details class="disclosure" style="border:none;background:transparent">
      <summary style="padding:0;font-size:11.5px;font-weight:600;color:var(--indigo);justify-content:flex-end">Atur</summary>
      <div class="disc-body" style="padding:10px 0;min-width:330px;text-align:left">
        <form method="post" action="${ctx.base}/structure/assign">
          ${ctx.csrfField}${ctx.backField}
          <input type="hidden" name="user_id" value="${u.id}">
          <div class="form-grid" style="gap:8px">
            <label class="field"><span>Jabatan</span>
              <select name="position_id">
                <option value="">— belum ditetapkan —</option>
                ${positions.filter((p) => p.company_id === u.company_id).map((p) => `<option value="${p.id}" ${u.position_id === p.id ? 'selected' : ''}>${U.h(p.name)}</option>`).join('')}
              </select>
            </label>
            <label class="field"><span>Atasan langsung</span>
              <select name="manager_id">
                <option value="">— tanpa atasan —</option>
                ${users.filter((m) => m.id !== u.id).map((m) => `<option value="${m.id}" ${u.manager_id === m.id ? 'selected' : ''}>${U.h(m.name)} · ${U.h(m.job_title || ROLE_LABELS[m.role] || '')}</option>`).join('')}
              </select>
            </label>
            <label class="field"><span>Entitas</span>
              <select name="company_id">${companySelect(ctx, data.companies, u.company_id, new Set(), false)}</select>
            </label>
            <label class="field"><span>Tarif/jam (Rp)</span><input name="hourly_rate" type="number" min="0" step="500" value="${u.hourly_rate || 0}"></label>
          </div>
          <div class="form-actions" style="margin-top:8px"><button class="btn btn-primary btn-sm" type="submit">Simpan penempatan</button></div>
        </form>
      </div>
    </details>` : U.h(u.job_title || '—')}</td>
    <td>${U.h(u.position_name || u.job_title || '—')}</td>
    <td>${U.h(u.manager_name || '—')}</td>
  </tr>`).join('');
}

// ---------------------------------------------------------------- chart pohon organisasi
//
// Satu komponen untuk dua pohon: **entitas** (holding → unit → outlet) dan **jabatan**
// (per entitas). Bisa diatur dari UI: modus entitas/jabatan, orientasi vertikal/horizontal,
// ukuran kartu (ringkas/nyaman/besar), buka-tutup cabang, geser urutan saudara, dan
// **tarik kartu ke kartu lain untuk memindahkan induk** (validasi tetap di server).

const ORG_ZOOM = { sm: 'Ringkas', md: 'Nyaman', lg: 'Besar' };

function sortByOrder(a, b) {
  return (a.sort_order || 0) - (b.sort_order || 0) || a.id - b.id;
}

/** Pohon entitas: akar = entitas yang induknya tidak terlihat dalam cakupan. */
function companyTreeNodes(data) {
  const byParent = new Map();
  for (const c of data.companies.slice().sort(sortByOrder)) {
    const key = c.parent_id || 0;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(c);
  }
  const build = (c) => ({ company: c, children: (byParent.get(c.id) || []).map(build) });
  return data.companies
    .filter((c) => !c.parent_id || !data.companyMap.has(c.parent_id))
    .sort(sortByOrder)
    .map(build);
}

/** Pohon jabatan untuk satu entitas: akar = jabatan yang atasannya di luar entitas itu. */
function positionTreeNodes(data, companyId) {
  const list = data.positions.filter((p) => p.company_id === companyId).sort(sortByOrder);
  const ids = new Set(list.map((p) => p.id));
  const byParent = new Map();
  for (const p of list) {
    const key = p.parent_id && ids.has(p.parent_id) ? p.parent_id : 0;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(p);
  }
  const build = (p) => ({ position: p, children: (byParent.get(p.id) || []).map(build) });
  return (byParent.get(0) || []).map(build);
}

function companyStatsMap(data) {
  const map = new Map();
  for (const row of data.tree) map.set(row.company.id, row);
  return map;
}

/** Menu kecil di dalam kartu: pindahkan induk & geser urutan (bekerja tanpa drag/JS). */
function orgNodeMenu(ctx, opts) {
  const { kind, id, name, parents, parentId, canMove, canOrder, index, total } = opts;
  const parentOptions = [`<option value="">— jadikan akar —</option>`]
    .concat(parents.map((p) => `<option value="${p.id}" ${Number(parentId) === p.id ? 'selected' : ''}>${U.h(p.label)}</option>`))
    .join('');
  return `<details class="org-menu">
    <summary aria-label="Atur ${U.h(name)}">${L.icon('settings', 14)}<span>Atur</span></summary>
    <div class="org-menu-body">
      ${canMove ? `<form method="post" action="${ctx.base}/structure/tree/move">
        ${ctx.csrfField}${ctx.backField}
        <input type="hidden" name="kind" value="${kind}">
        <input type="hidden" name="id" value="${id}">
        <label class="field"><span>Pindahkan di bawah</span>
          <select name="parent_id">${parentOptions}</select>
        </label>
        <button class="btn btn-primary btn-sm" type="submit">Pindahkan</button>
      </form>` : `<p class="hint-text">Memindahkan induk entitas hanya dapat dilakukan owner. Anda tetap dapat mengubah urutan.</p>`}
      ${canOrder ? `<div class="org-order">
        <form method="post" action="${ctx.base}/structure/tree/order">
          ${ctx.csrfField}${ctx.backField}
          <input type="hidden" name="kind" value="${kind}">
          <input type="hidden" name="id" value="${id}">
          <input type="hidden" name="direction" value="up">
          <button class="btn btn-ghost btn-sm" type="submit" ${index === 0 ? 'disabled' : ''}>↑ Naik</button>
        </form>
        <form method="post" action="${ctx.base}/structure/tree/order">
          ${ctx.csrfField}${ctx.backField}
          <input type="hidden" name="kind" value="${kind}">
          <input type="hidden" name="id" value="${id}">
          <input type="hidden" name="direction" value="down">
          <button class="btn btn-ghost btn-sm" type="submit" ${index === total - 1 ? 'disabled' : ''}>↓ Turun</button>
        </form>
      </div>` : ''}
    </div>
  </details>`;
}

function orgNode(ctx, data, item, opts) {
  const { kind, depth, index, total, canDrag, canMove, canOrder, stats } = opts;
  const isCompany = kind === 'company';
  const row = isCompany ? item.company : item.position;
  const id = row.id;
  const name = isCompany ? row.name : row.name;
  const levelKey = isCompany ? row.level : row.level;
  const levelLabel = isCompany ? (LEVEL_LABEL[row.level] || row.level) : (POS_LEVEL_LABEL[row.level] || row.level);
  const parentId = row.parent_id || '';

  // Kandidat induk: untuk entitas hanya owner yang boleh memindahkan; untuk jabatan cukup structure_write.
  let parents = [];
  if (canDrag) {
    if (isCompany) {
      const blocked = data.descendantIdsOf(id);
      parents = data.companies.filter((c) => !blocked.has(c.id))
        .map((c) => ({ id: c.id, label: c.name }));
    } else {
      const forbidden = new Set();
      const walk = (p) => {
        forbidden.add(p.id);
        for (const child of data.positions.filter((x) => x.parent_id === p.id)) walk(child);
      };
      walk(row);
      parents = data.positions
        .filter((p) => p.company_id === row.company_id && !forbidden.has(p.id))
        .map((p) => ({ id: p.id, label: p.name }));
    }
  }

  const st = isCompany ? (stats.get(id) || { users: 0, positions: 0, outlets: 0, revenue: 0 }) : null;
  const members = isCompany ? [] : (data.usersByPosition.get(id) || []);
  const meta = isCompany
    ? `${U.h(row.code || '—')} · ${st.outlets} outlet · ${st.users} pengguna · ${st.positions} jabatan`
    : (members.length ? `${members.length} pemegang jabatan` : 'belum ada pemegang jabatan');

  const children = item.children || [];
  const hasChildren = children.length > 0;
  const childIds = hasChildren ? `${kind}-${id}` : '';

  return `<li class="org-node level-${U.h(levelKey)}" data-org-id="${id}" data-org-kind="${kind}"
      data-org-parent="${parentId}" data-org-name="${U.h(name)}"${isCompany ? '' : ` data-org-company="${row.company_id}"`}>
    <div class="org-card${hasChildren ? ' has-children' : ''}">
      <div class="org-card-top">
        <span class="org-level">${U.h(levelLabel)}</span>
        ${hasChildren ? `<button class="org-toggle" type="button" data-org-toggle="${childIds}" aria-expanded="true"
          aria-label="Tutup cabang ${U.h(name)}" title="Buka/tutup cabang">${L.icon('layers', 13)}</button>` : ''}
        ${canDrag ? `<button class="org-drag" type="button" data-org-drag aria-label="Tarik ${U.h(name)} untuk memindahkan induk"
          title="Tarik ke kartu lain untuk memindahkan induk">${L.icon('grid', 13)}</button>` : ''}
      </div>
      <strong class="org-name">${U.h(name)}</strong>
      <span class="org-meta">${isCompany ? meta : U.h(meta)}</span>
      ${members.length ? `<div class="org-members">${members.slice(0, 3).map((u) => `<span class="org-member">${initialsAvatar(u, 20)}<span>${U.h(u.name.split(' ')[0])}</span></span>`).join('')}
        ${members.length > 3 ? `<span class="org-more">+${members.length - 3}</span>` : ''}</div>` : ''}
      ${(canDrag && parents.length) || canOrder ? orgNodeMenu(ctx, {
        kind, id, name, parents, parentId, canMove: canDrag && parents.length > 0, canOrder, index, total,
      }) : ''}
    </div>
    ${hasChildren ? `<ul data-org-children="${childIds}">${children.map((c, i) => orgNode(ctx, data, c, {
      ...opts, depth: depth + 1, index: i, total: children.length,
    })).join('')}</ul>` : ''}
  </li>`;
}

function orgChartCard(ctx, data, opts) {
  const { mode, companyId, canWrite, canMove } = opts;
  const stats = companyStatsMap(data);
  const isCompanyMode = mode === 'company';
  // Memindahkan induk: entitas hanya owner (aturan lama), jabatan cukup structure_write.
  const canDrag = isCompanyMode ? canMove : canWrite;
  const canOrder = canWrite;

  const nodes = isCompanyMode
    ? companyTreeNodes(data)
    : positionTreeNodes(data, companyId);

  const totalNodes = (list) => list.reduce((sum, n) => sum + 1 + totalNodes(n.children), 0);
  const count = totalNodes(nodes);

  const entityOptions = data.companies.map((c) => `<option value="${c.id}" ${Number(companyId) === c.id ? 'selected' : ''}>${U.h(c.name)}</option>`).join('');
  const modeLink = (m, label) => `<a class="org-mode${mode === m ? ' is-active' : ''}"
      href="${ctx.base}/structure?tree=${m}${m === 'position' ? `&company=${Number(companyId)}` : ''}"
      ${mode === m ? 'aria-current="page"' : ''}>${label}</a>`;

  const treeHtml = nodes.length
    ? `<ul class="org-tree" data-org-tree data-org-mode="${isCompanyMode ? 'company' : 'position'}" data-zoom="md" data-orient="v">${nodes.map((n, i) => orgNode(ctx, data, n, {
      kind: isCompanyMode ? 'company' : 'position',
      depth: 0, index: i, total: nodes.length, canDrag, canMove, canOrder, stats,
    })).join('')}</ul>`
    : L.empty(isCompanyMode ? 'Belum ada entitas' : 'Belum ada jabatan di entitas ini');

  return L.card({
    title: 'Peta pohon organisasi',
    subtitle: isCompanyMode
      ? `${nodes.length} akar · ${count} entitas · bisa diatur tampilannya`
      : `${count} jabatan · ${U.h((data.companyMap.get(Number(companyId)) || {}).name || '')}`,
  }, `
    <div class="org-toolbar">
      <div class="org-modes" role="tablist" aria-label="Jenis pohon">
        ${modeLink('company', 'Entitas')}
        ${modeLink('position', 'Jabatan')}
      </div>
      ${isCompanyMode ? '' : `<form method="get" action="${ctx.base}/structure" class="org-filter">
        <input type="hidden" name="tree" value="position">
        <label class="field"><span>Entitas</span><select name="company" onchange="this.form.submit()">${entityOptions}</select></label>
        <noscript><button class="btn btn-ghost btn-sm" type="submit">Tampilkan</button></noscript>
      </form>`}
      <div class="org-tools">
        <button class="org-btn" type="button" data-org-orient aria-pressed="false" title="Ubah arah pohon">${L.icon('sitemap', 14)} <span data-org-orient-label>Vertikal</span></button>
        <div class="org-zoom" role="group" aria-label="Ukuran kartu">
          <button class="org-btn" type="button" data-org-zoom="out" aria-label="Perkecil kartu">−</button>
          <span class="org-zoom-label" data-org-zoom-label>Nyaman</span>
          <button class="org-btn" type="button" data-org-zoom="in" aria-label="Perbesar kartu">+</button>
        </div>
        <button class="org-btn" type="button" data-org-expand="all">Buka semua</button>
        <button class="org-btn" type="button" data-org-expand="none">Tutup semua</button>
      </div>
    </div>
    ${canDrag ? `<p class="hint-text org-hint" data-org-hint>${L.icon('sitemap', 13)}
      Tarik ikon <span class="org-hint-grip">⋮⋮</span> pada kartu ke kartu lain untuk memindahkan induk,
      atau pakai menu <b>Atur</b> di tiap kartu. Urutan saudara diatur dengan ↑ / ↓.</p>`
    : `<p class="hint-text org-hint" data-org-hint>${L.icon('sitemap', 13)} Tampilan pohon bisa diatur (arah, ukuran, buka-tutup).
      Memindahkan induk memerlukan hak tulis struktur${isCompanyMode ? ' — untuk entitas hanya owner' : ''}.</p>`}
    <div class="org-scroll" data-org-scroll>
      ${treeHtml}
    </div>
    <p class="hint-text" data-org-status aria-live="polite"></p>`);
}

function structurePage(ctx, data) {
  const { canWrite, canMove, stats, companyMap } = data;

  const addCompany = canWrite ? L.card({ title: 'Tambah entitas', subtitle: 'Holding, unit usaha, atau cabang baru di bawah struktur Anda' }, `
    <form method="post" action="${ctx.base}/structure/company/save">
      ${ctx.csrfField}${ctx.backField}
      <div class="form-grid cols-3">
        <label class="field"><span>Nama entitas</span><input name="name" required placeholder="mis. Coffee Station 3.0"></label>
        <label class="field"><span>Kode</span><input name="code" placeholder="mis. BALI"></label>
        <label class="field"><span>Tingkat</span>
          <select name="level"><option value="outlet">Cabang / Outlet</option><option value="unit">Unit usaha</option><option value="holding">Holding</option></select>
        </label>
        <label class="field"><span>Induk</span><select name="parent_id">${companySelect(ctx, data.companies, ctx.user.company_id)}</select></label>
        <label class="field"><span>Telepon</span><input name="phone" placeholder="021-xxxx"></label>
        <label class="field"><span>Alamat</span><input name="address" placeholder="Jl. …"></label>
        <label class="field"><span>Area asal kirim</span><input name="origin_area" placeholder="mis. Kemang"></label>
        <label class="field"><span>Kode pos asal</span><input name="origin_zip" placeholder="12730"></label>
        <label class="field"><span>Telepon pengirim</span><input name="origin_phone" placeholder="08xxxxxxxxxx"></label>
      </div>
      <div class="form-actions"><button class="btn btn-primary" type="submit">${L.icon('plus', 15)} Simpan entitas</button></div>
    </form>`) : '';

  const addPosition = canWrite ? L.card({ title: 'Tambah jabatan', subtitle: 'Jabatan bisa dilekatkan ke entitas mana pun dalam cakupan Anda' }, `
    <form method="post" action="${ctx.base}/structure/position/save">
      ${ctx.csrfField}${ctx.backField}
      <div class="form-grid cols-3">
        <label class="field"><span>Nama jabatan</span><input name="name" required placeholder="mis. Head Roaster"></label>
        <label class="field"><span>Tingkat</span>
          <select name="level">${Object.entries(POS_LEVEL_LABEL).map(([k, v]) => `<option value="${k}" ${k === 'staff' ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </label>
        <label class="field"><span>Entitas</span><select name="company_id">${companySelect(ctx, data.companies, ctx.selectedCompanyId || ctx.user.company_id, new Set(), false)}</select></label>
        <label class="field"><span>Atasan jabatan</span>
          <select name="parent_id"><option value="">— puncak —</option>
            ${data.positions.map((p) => `<option value="${p.id}">${U.h(p.name)} · ${U.h(companyMap.get(p.company_id) ? companyMap.get(p.company_id).name : '')}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Urutan</span><input name="sort_order" type="number" step="1" value="0"></label>
      </div>
      <div class="form-actions"><button class="btn btn-primary" type="submit">${L.icon('plus', 15)} Simpan jabatan</button></div>
    </form>`) : '';

  const body = `
    <div class="grid grid-4">
      ${[['Entitas', U.num(stats.companies), 'holding + unit + cabang'],
        ['Jabatan', U.num(stats.positions), `${stats.positionsUnassigned} belum terisi`],
        ['Pengguna', U.num(stats.users), 'tersebar di semua entitas'],
        ['Cabang', U.num(stats.outlets), 'outlet aktif']].map(([label, value, sub]) => `<article class="stat">
          <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
          <div class="stat-value">${value}</div>
          <div class="stat-sub">${U.h(sub)}</div>
        </article>`).join('')}
    </div>

    ${orgChartCard(ctx, data, {
      mode: data.chartMode || 'company',
      companyId: data.chartCompanyId,
      canWrite,
      canMove,
    })}

    ${L.card({ title: 'Hierarki entitas', subtitle: canMove ? 'Klik "Ubah" untuk mengganti nama, tingkat, atau memindahkan induk' : 'Anda dapat melihat struktur; perubahan entitas hanya oleh owner' }, `
      <div class="table-wrap"><table class="data tree-table">
        <thead><tr><th>Entitas</th><th class="num">Cabang</th><th class="num">Pengguna</th><th class="num">Jabatan</th><th class="num">Omzet bulan ini</th><th></th></tr></thead>
        <tbody>${companyRows(ctx, data)}</tbody>
      </table></div>`)}

    ${L.card({ title: 'Struktur jabatan', subtitle: 'Setiap jabatan punya atasan jabatan dan pemegangnya' }, `
      <div class="pos-groups">${positionCards(ctx, data) || L.empty('Belum ada jabatan')}</div>`)}

    ${L.card({ title: 'Penempatan orang', subtitle: 'Atur jabatan, atasan langsung, entitas, dan tarif per jam' }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Pengguna</th><th>Entitas</th><th>Peran</th><th class="num">Penempatan</th><th>Jabatan</th><th>Atasan</th></tr></thead>
        <tbody>${peopleRows(ctx, data)}</tbody>
      </table></div>`)}

    <div class="grid grid-2">${addCompany}${addPosition}</div>
  `;

  return L.shell(ctx, {
    title: 'Struktur Organisasi',
    subtitle: 'Hierarki jabatan, unit usaha, dan cabang — bisa disesuaikan',
    active: '/structure',
    content: body,
  });
}

module.exports = { structurePage, LEVEL_LABEL, POS_LEVEL_LABEL };
