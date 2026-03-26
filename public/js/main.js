const state = {
  wasteTypes: [],
  collectionPoints: [],
  reports: [],
  currentUserId: null
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
  gallery: byId('waste-gallery'),
  pointsBody: byId('point-public-body'),
  badgeList: byId('badge-list'),
  nearestMessage: byId('nearest-message'),
  formMessage: byId('form-message'),
  profileUserLabel: byId('profile-user-label')
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
  const route = hash.replace('#/', '') || 'home';
  const exists = ui.pages.some((p) => p.dataset.page === route);
  return exists ? route : 'home';
}

function applyRoute() {
  const route = routeFromHash();
  ui.pages.forEach((page) => page.classList.toggle('active', page.dataset.page === route));
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
  if (!response.ok) throw new Error(`Ошибка API: ${response.status}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function renderWasteGallery() {
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

  const wasteOptions = state.wasteTypes
    .map((w) => `<option value="${w.id}">${escapeHtml(w.name)}</option>`)
    .join('');
  byId('report-waste').innerHTML = wasteOptions;
}

function renderPoints(points = state.collectionPoints) {
  ui.pointsBody.innerHTML = points.map((p) => `
    <tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.city)}</td>
      <td>${escapeHtml(p.address)}</td>
    </tr>
  `).join('');

  const pointOptions = state.collectionPoints
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.city)})</option>`)
    .join('');
  byId('report-point').innerHTML = pointOptions;
}

function getUserReports(userId) {
  return state.reports.filter((r) => Number(r.user_id) === Number(userId));
}

function renderAchievementsForUser(userId) {
  if (!userId) {
    ui.badgeList.innerHTML = '<span class="badge">Укажите User ID, чтобы увидеть достижения</span>';
    return;
  }

  const userReports = getUserReports(userId);
  const weight = userReports.reduce((sum, r) => sum + Number(r.weight_kg || 0), 0);
  const points = userReports.reduce((sum, r) => sum + Number(r.earnedPoints || 0), 0);

  const achievements = [
    { title: 'Первый отчёт', unlocked: userReports.length >= 1 },
    { title: '10 отчётов', unlocked: userReports.length >= 10 },
    { title: '100 кг сдано', unlocked: weight >= 100 },
    { title: '1000 баллов', unlocked: points >= 1000 }
  ];

  ui.badgeList.innerHTML = achievements
    .map((a) => `<span class="badge ${a.unlocked ? 'active' : ''}">${a.title}</span>`)
    .join('');
}

function renderProfile(userId) {
  if (!userId) {
    ui.profileUserLabel.textContent = 'User ID не выбран';
    byId('profile-reports').textContent = '0';
    byId('profile-weight').textContent = '0';
    byId('profile-points').textContent = '0';
    return;
  }

  const userReports = getUserReports(userId);
  const weight = userReports.reduce((sum, r) => sum + Number(r.weight_kg || 0), 0);
  const points = userReports.reduce((sum, r) => sum + Number(r.earnedPoints || 0), 0);

  ui.profileUserLabel.textContent = `Статистика для User ID: ${userId}`;
  byId('profile-reports').textContent = fmt(userReports.length);
  byId('profile-weight').textContent = fmt(weight);
  byId('profile-points').textContent = fmt(points);
}

function setCurrentUserId(userId) {
  state.currentUserId = Number(userId);
  localStorage.setItem('eco_user_id', String(state.currentUserId));
  byId('global-user-id').value = state.currentUserId;
  renderProfile(state.currentUserId);
  renderAchievementsForUser(state.currentUserId);
}

async function loadAll() {
  try {
    byId('refresh-all').disabled = true;
    const [wasteTypes, collectionPoints, reports] = await Promise.all([
      api('/waste-types'),
      api('/collection-points'),
      api('/reports')
    ]);

    state.wasteTypes = wasteTypes;
    state.collectionPoints = collectionPoints;
    state.reports = reports;

    renderWasteGallery();
    renderPoints();
    renderProfile(state.currentUserId);
    renderAchievementsForUser(state.currentUserId);
  } catch (error) {
    ui.formMessage.textContent = error.message;
  } finally {
    byId('refresh-all').disabled = false;
  }
}

byId('user-context-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const userId = Number(byId('global-user-id').value);
  if (!userId) return;
  setCurrentUserId(userId);
  ui.formMessage.textContent = 'User ID сохранён. Теперь можно сдавать отходы.';
});

byId('report-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.currentUserId) {
    ui.formMessage.textContent = 'Сначала укажите User ID в верхней панели.';
    return;
  }

  const payload = {
    user_id: state.currentUserId,
    waste_type_id: Number(byId('report-waste').value),
    collection_point_id: Number(byId('report-point').value),
    weight_kg: Number(byId('report-weight').value)
  };

  try {
    const result = await api('/reports', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    ui.formMessage.textContent = `✅ Готово! Начислено ${fmt(result.earnedPoints)} баллов.`;
    e.target.reset();
    await loadAll();
  } catch (error) {
    ui.formMessage.textContent = `❌ ${error.message}`;
  }
});

byId('nearest-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const city = byId('nearest-city').value.trim().toLowerCase();
  const exact = state.collectionPoints.filter((p) => p.city.toLowerCase() === city);
  const similar = state.collectionPoints.filter((p) => p.city.toLowerCase().includes(city));

  const result = exact.length ? exact : similar;
  if (!result.length) {
    ui.nearestMessage.textContent = 'Пункты в этом городе не найдены. Показаны все доступные.';
    renderPoints(state.collectionPoints);
    return;
  }

  ui.nearestMessage.textContent = `Найдено пунктов: ${result.length}`;
  renderPoints(result);
});

byId('refresh-all').addEventListener('click', loadAll);
window.addEventListener('hashchange', applyRoute);

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const savedUserId = Number(localStorage.getItem('eco_user_id'));
if (savedUserId) setCurrentUserId(savedUserId);

applyRoute();
loadAll();
