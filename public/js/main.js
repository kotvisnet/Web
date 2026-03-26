const state = {
  wasteTypes: [],
  collectionPoints: [],
  reports: []
};

const wasteImages = {
  plastic: '/images/plastic.svg',
  paper: '/images/paper.svg',
  glass: '/images/glass.svg',
  metal: '/images/metal.svg',
  organic: '/images/organic.svg',
  default: '/images/organic.svg'
};

const byId = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 });

const ui = {
  pages: [...document.querySelectorAll('.page')],
  links: [...document.querySelectorAll('[data-link]')],
  wasteBody: byId('waste-body'),
  pointBody: byId('point-body'),
  pointPublicBody: byId('point-public-body'),
  reportBody: byId('report-body'),
  badgeList: byId('badge-list'),
  gallery: byId('waste-gallery'),
  formMessage: byId('form-message'),
  pointSearch: byId('point-search')
};

function getWasteImage(name = '', description = '') {
  const text = `${name} ${description}`.toLowerCase();
  if (text.includes('пласт') || text.includes('plastic')) return wasteImages.plastic;
  if (text.includes('бумаг') || text.includes('картон') || text.includes('paper')) return wasteImages.paper;
  if (text.includes('стекл') || text.includes('glass')) return wasteImages.glass;
  if (text.includes('металл') || text.includes('алюмин') || text.includes('metal')) return wasteImages.metal;
  if (text.includes('орган') || text.includes('food') || text.includes('био')) return wasteImages.organic;
  return wasteImages.default;
}

function routeFromHash() {
  const hash = window.location.hash || '#/home';
  return hash.replace('#/', '') || 'home';
}

function applyRoute() {
  const route = routeFromHash();
  ui.pages.forEach((page) => {
    page.classList.toggle('active', page.dataset.page === route);
  });

  ui.links.forEach((link) => {
    const target = link.getAttribute('href').replace('#/', '');
    link.classList.toggle('active', target === route);
  });
}

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    let message = 'Ошибка API';
    try {
      const err = await response.json();
      message = err.error || message;
    } catch (_e) {
      message = `${message}: ${response.status}`;
    }
    throw new Error(message);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function renderWasteTypes() {
  ui.wasteBody.innerHTML = state.wasteTypes.map((w) => {
    const image = getWasteImage(w.name, w.description);
    return `
      <tr>
        <td>${w.id}</td>
        <td><img class="waste-icon" src="${image}" alt="${escapeHtml(w.name)}" /></td>
        <td>${escapeHtml(w.name)}</td>
        <td>${escapeHtml(w.description)}</td>
        <td>${fmt(w.eco_points_per_kg)}</td>
        <td class="actions">
          <button type="button" class="btn btn-ghost" data-action="edit-waste" data-id="${w.id}">Изм.</button>
          <button type="button" class="btn btn-danger" data-action="delete-waste" data-id="${w.id}">Удалить</button>
        </td>
      </tr>
    `;
  }).join('');

  byId('report-waste').innerHTML = state.wasteTypes
    .map((w) => `<option value="${w.id}">${escapeHtml(w.name)}</option>`)
    .join('');

  ui.gallery.innerHTML = state.wasteTypes.map((w) => {
    const image = getWasteImage(w.name, w.description);
    return `
      <article class="gallery-item">
        <img src="${image}" alt="${escapeHtml(w.name)}" />
        <div>
          <p><strong>${escapeHtml(w.name)}</strong></p>
          <p>${fmt(w.eco_points_per_kg)} балла/кг</p>
        </div>
      </article>
    `;
  }).join('');
}

function renderCollectionPoints() {
  const query = ui.pointSearch.value.trim().toLowerCase();
  const filtered = state.collectionPoints.filter((p) =>
    [p.name, p.city, p.address].join(' ').toLowerCase().includes(query)
  );

  const rows = filtered.map((p) => `
    <tr>
      <td>${p.id}</td>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.city)}</td>
      <td>${escapeHtml(p.address)}</td>
      <td class="actions">
        <button type="button" class="btn btn-ghost" data-action="edit-point" data-id="${p.id}">Изм.</button>
        <button type="button" class="btn btn-danger" data-action="delete-point" data-id="${p.id}">Удалить</button>
      </td>
    </tr>
  `).join('');

  ui.pointBody.innerHTML = rows;
  ui.pointPublicBody.innerHTML = filtered.map((p) => `
    <tr>
      <td>${p.id}</td>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.city)}</td>
      <td>${escapeHtml(p.address)}</td>
    </tr>
  `).join('');

  byId('report-point').innerHTML = state.collectionPoints
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.city)})</option>`)
    .join('');
}

function renderReports() {
  ui.reportBody.innerHTML = state.reports.slice().reverse().map((r) => `
    <tr>
      <td>${r.id}</td>
      <td>${r.user_id}</td>
      <td>${r.waste_type_id}</td>
      <td>${r.collection_point_id}</td>
      <td>${fmt(r.weight_kg)}</td>
      <td>${fmt(r.earnedPoints)}</td>
    </tr>
  `).join('');

  const totalReports = state.reports.length;
  const totalWeight = state.reports.reduce((sum, r) => sum + Number(r.weight_kg || 0), 0);
  const totalPoints = state.reports.reduce((sum, r) => sum + Number(r.earnedPoints || 0), 0);
  const activeUsers = new Set(state.reports.map((r) => r.user_id)).size;

  byId('stat-reports').textContent = fmt(totalReports);
  byId('stat-weight').textContent = fmt(totalWeight);
  byId('stat-points').textContent = fmt(totalPoints);
  byId('stat-users').textContent = fmt(activeUsers);

  renderAchievements(totalPoints, totalReports, totalWeight);
}

function renderAchievements(points, reports, weight) {
  const achievements = [
    { title: 'Первый вклад', unlocked: reports >= 1 },
    { title: 'Эко-активист', unlocked: reports >= 10 },
    { title: '100 кг спасено', unlocked: weight >= 100 },
    { title: '1000 эко-баллов', unlocked: points >= 1000 }
  ];

  ui.badgeList.innerHTML = achievements
    .map((a) => `<span class="badge ${a.unlocked ? 'active' : ''}">${a.title}</span>`)
    .join('');
}

async function loadAll() {
  try {
    const [wasteTypes, collectionPoints, reports] = await Promise.all([
      api('/waste-types'),
      api('/collection-points'),
      api('/reports')
    ]);

    state.wasteTypes = wasteTypes;
    state.collectionPoints = collectionPoints;
    state.reports = reports;

    renderWasteTypes();
    renderCollectionPoints();
    renderReports();
  } catch (error) {
    ui.formMessage.textContent = `Ошибка загрузки данных: ${error.message}`;
  }
}

byId('waste-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = byId('waste-id').value;

  const payload = {
    name: byId('waste-name').value.trim(),
    description: byId('waste-description').value.trim(),
    eco_points_per_kg: Number(byId('waste-points').value)
  };

  await api(`/waste-types${id ? `/${id}` : ''}`, {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(payload)
  });

  e.target.reset();
  byId('waste-id').value = '';
  await loadAll();
});

byId('point-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = byId('point-id').value;

  const payload = {
    name: byId('point-name').value.trim(),
    city: byId('point-city').value.trim(),
    address: byId('point-address').value.trim()
  };

  await api(`/collection-points${id ? `/${id}` : ''}`, {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(payload)
  });

  e.target.reset();
  byId('point-id').value = '';
  await loadAll();
});

byId('report-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const payload = {
      user_id: Number(byId('report-user').value),
      waste_type_id: Number(byId('report-waste').value),
      collection_point_id: Number(byId('report-point').value),
      weight_kg: Number(byId('report-weight').value)
    };

    const result = await api('/reports', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    ui.formMessage.textContent = `✅ Отходы приняты! Вам начислено ${fmt(result.earnedPoints)} баллов.`;
    e.target.reset();
    await loadAll();
  } catch (error) {
    ui.formMessage.textContent = `❌ Не удалось отправить отчёт: ${error.message}`;
  }
});

document.body.addEventListener('click', async (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const { action, id } = target.dataset;
  if (!action || !id) return;

  if (action === 'edit-waste') {
    const row = state.wasteTypes.find((w) => String(w.id) === id);
    if (!row) return;
    byId('waste-id').value = row.id;
    byId('waste-name').value = row.name;
    byId('waste-description').value = row.description;
    byId('waste-points').value = row.eco_points_per_kg;
    window.location.hash = '#/manage';
  }

  if (action === 'delete-waste' && confirm('Удалить тип отходов?')) {
    await api(`/waste-types/${id}`, { method: 'DELETE' });
    await loadAll();
  }

  if (action === 'edit-point') {
    const row = state.collectionPoints.find((p) => String(p.id) === id);
    if (!row) return;
    byId('point-id').value = row.id;
    byId('point-name').value = row.name;
    byId('point-city').value = row.city;
    byId('point-address').value = row.address;
    window.location.hash = '#/manage';
  }

  if (action === 'delete-point' && confirm('Удалить пункт приёма?')) {
    await api(`/collection-points/${id}`, { method: 'DELETE' });
    await loadAll();
  }
});

byId('waste-reset').addEventListener('click', () => {
  byId('waste-form').reset();
  byId('waste-id').value = '';
});

byId('point-reset').addEventListener('click', () => {
  byId('point-form').reset();
  byId('point-id').value = '';
});

byId('refresh-all').addEventListener('click', loadAll);
ui.pointSearch.addEventListener('input', renderCollectionPoints);
window.addEventListener('hashchange', applyRoute);

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

applyRoute();
loadAll();
