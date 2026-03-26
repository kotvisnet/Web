const state = {
  wasteTypes: [],
  points: [],
  reports: [],
  localReports: [],
  userId: null
};

const images = {
  plastic: 'images/plastic.svg',
  paper: 'images/paper.svg',
  glass: 'images/glass.svg',
  metal: 'images/metal.svg',
  organic: 'images/organic.svg',
  default: 'images/organic.svg'
};

const byId = (id) => document.getElementById(id);
const hasEl = (id) => Boolean(document.getElementById(id));
const fmt = (n) => Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const normalize = (v) => String(v || '').trim().toLowerCase();

function getImage(name = '', description = '') {
  const text = `${name} ${description}`.toLowerCase();
  if (text.includes('пласт') || text.includes('plastic')) return images.plastic;
  if (text.includes('бумаг') || text.includes('paper') || text.includes('картон')) return images.paper;
  if (text.includes('стекл') || text.includes('glass')) return images.glass;
  if (text.includes('металл') || text.includes('metal')) return images.metal;
  if (text.includes('орган') || text.includes('био') || text.includes('food')) return images.organic;
  return images.default;
}

function getCurrentUserReports() {
  if (!state.userId) return [];
  const apiReports = state.reports.filter((r) => Number(r.user_id) === Number(state.userId));
  const localReports = state.localReports.filter((r) => Number(r.user_id) === Number(state.userId));
  return [...apiReports, ...localReports];
}

function renderWasteGallery() {
  if (!hasEl('waste-gallery')) return;

  if (hasEl('waste-types-list')) {
    byId('waste-types-list').innerHTML = state.wasteTypes
      .map((w) => `<option value="${escapeHtml(w.name)}"></option>`)
      .join('');
  }

  if (!state.wasteTypes.length) {
    byId('waste-gallery').innerHTML = '<p>Можно сдавать: пластик, бумагу, стекло, металл и органику.</p>';
    return;
  }

  byId('waste-gallery').innerHTML = state.wasteTypes.map((w) => {
    const img = getImage(w.name, w.description);
    return `
      <article class="gallery-item">
        <img src="${img}" alt="${escapeHtml(w.name)}" />
        <div>
          <div><strong>${escapeHtml(w.name)}</strong></div>
          <div>${fmt(w.eco_points_per_kg)} балла/кг</div>
        </div>
      </article>
    `;
  }).join('');
}

function renderBenefits() {
  if (!hasEl('waste-benefits')) return;
  const defaultReasons = [
    'Пластик: меньше загрязнения рек и морей.',
    'Бумага: сохраняются деревья и вода.',
    'Стекло: перерабатывается многократно.',
    'Металл: экономит энергию и сырьё.',
    'Органика: меньше метана на полигонах.'
  ];

  const fromDb = state.wasteTypes.map((w) => `${escapeHtml(w.name)}: ${escapeHtml(w.description || 'полезно сдавать на переработку')}.`);
  const list = fromDb.length ? fromDb : defaultReasons;
  byId('waste-benefits').innerHTML = list.map((item) => `<li>${item}</li>`).join('');
}

function renderPoints(points = state.points) {
  if (hasEl('points-list')) {
    byId('points-list').innerHTML = state.points
      .map((p) => `<option value="${escapeHtml(p.name)}"></option>`)
      .join('');
  }

  if (!hasEl('points-body')) return;
  byId('points-body').innerHTML = points.length
    ? points.map((p) => `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.city)}</td><td>${escapeHtml(p.address)}</td></tr>`).join('')
    : '<tr><td colspan="3">Пункты сбора пока не загружены.</td></tr>';
}

function renderUserStats() {
  if (!hasEl('stat-reports')) return;
  const reports = getCurrentUserReports();
  const weight = reports.reduce((sum, r) => sum + Number(r.weight_kg || 0), 0);
  const wasteMap = new Map(state.wasteTypes.map((w) => [String(w.id), Number(w.eco_points_per_kg || 10)]));
  const points = reports.reduce((sum, r) => {
    if (r.earnedPoints !== undefined && r.earnedPoints !== null) return sum + Number(r.earnedPoints);
    const perKg = wasteMap.get(String(r.waste_type_id)) || Number(r.points_per_kg || 10);
    return sum + perKg * Number(r.weight_kg || 0);
  }, 0);

  byId('stat-reports').textContent = fmt(reports.length);
  byId('stat-weight').textContent = fmt(weight);
  byId('stat-points').textContent = fmt(points);

  if (hasEl('badge-list')) {
    const badges = [
      { title: 'Первый отчёт', ok: reports.length >= 1 },
      { title: '10 отчётов', ok: reports.length >= 10 },
      { title: '100 кг', ok: weight >= 100 },
      { title: '1000 баллов', ok: points >= 1000 }
    ];

    byId('badge-list').innerHTML = state.userId
      ? badges.map((b) => `<span class="badge ${b.ok ? 'active' : ''}">${b.title}</span>`).join('')
      : '<span class="badge">Сначала войдите в профиль</span>';
  }
}

function saveLocalReports() {
  localStorage.setItem('eco_local_reports', JSON.stringify(state.localReports));
}

function loadLocalReports() {
  try {
    state.localReports = JSON.parse(localStorage.getItem('eco_local_reports') || '[]');
  } catch {
    state.localReports = [];
  }
}

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (!response.ok) {
    if (response.status === 504 || text.includes('504 Gateway Time-out')) {
      throw new Error('Сервер временно недоступен (504). Попробуйте снова позже.');
    }
    throw new Error(`Ошибка API: ${response.status}`);
  }

  if (!text) return null;
  return contentType.includes('application/json') ? JSON.parse(text) : null;
}

async function loadData() {
  const [wasteResult, pointsResult, reportsResult] = await Promise.allSettled([
    api('/waste-types'),
    api('/collection-points'),
    api('/reports')
  ]);

  state.wasteTypes = wasteResult.status === 'fulfilled' ? wasteResult.value : [];
  state.points = pointsResult.status === 'fulfilled' ? pointsResult.value : [];
  state.reports = reportsResult.status === 'fulfilled' ? reportsResult.value : [];

  renderWasteGallery();
  renderBenefits();
  renderPoints(state.points);
  renderUserStats();

  const failed = [wasteResult, pointsResult, reportsResult].find((r) => r.status === 'rejected');
  if (failed) {
    if (hasEl('report-message')) byId('report-message').textContent = failed.reason.message;
    if (hasEl('profile-message')) byId('profile-message').textContent = failed.reason.message;
  }
}

if (hasEl('user-form')) {
  byId('user-form').addEventListener('submit', (e) => {
    e.preventDefault();
    state.userId = Number(byId('user-id').value);
    localStorage.setItem('eco_user_id', String(state.userId));
    if (hasEl('profile-id')) byId('profile-id').value = state.userId;
    if (hasEl('report-message')) byId('report-message').textContent = 'User ID сохранён.';
    renderUserStats();
  });
}

if (hasEl('profile-form')) {
  byId('profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    state.userId = Number(byId('profile-id').value);
    localStorage.setItem('eco_user_id', String(state.userId));
    if (hasEl('user-id')) byId('user-id').value = state.userId;
    byId('profile-message').textContent = `Вход выполнен: User ID ${state.userId}`;
    renderUserStats();
  });
}

if (hasEl('delete-account')) {
  byId('delete-account').addEventListener('click', async () => {
    if (!state.userId) {
      byId('profile-message').textContent = 'Сначала войдите в профиль.';
      return;
    }

    if (!confirm('Удалить аккаунт и данные пользователя?')) return;

    state.localReports = state.localReports.filter((r) => Number(r.user_id) !== Number(state.userId));
    saveLocalReports();

    try {
      await api(`/api/users/${state.userId}`, { method: 'DELETE' });
    } catch {
      // Если сервер не поддерживает удаление, удаляем только локальные данные
    }

    state.userId = null;
    localStorage.removeItem('eco_user_id');
    byId('profile-id').value = '';
    if (hasEl('user-id')) byId('user-id').value = '';
    byId('profile-message').textContent = 'Аккаунт удалён (локально).';
    renderUserStats();
  });
}

if (hasEl('report-form')) {
  byId('report-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.userId) {
      byId('report-message').textContent = 'Сначала сохраните User ID.';
      return;
    }

    const wasteName = byId('waste-type-name').value.trim();
    const pointName = byId('collection-point-name').value.trim();
    const weight = Number(byId('report-weight').value);

    if (!wasteName || !pointName || !weight) {
      byId('report-message').textContent = 'Заполните вид отхода, пункт приёма и количество.';
      return;
    }

    const matchedWaste = state.wasteTypes.find((w) => normalize(w.name) === normalize(wasteName));
    const matchedPoint = state.points.find((p) => normalize(p.name) === normalize(pointName));

    if (!matchedWaste) {
      byId('report-message').textContent = 'Выберите вид отхода из списка (например: Пластик).';
      return;
    }

    if (!matchedPoint) {
      byId('report-message').textContent = 'Выберите пункт приёма из списка.';
      return;
    }

    const pointsPerKg = Number(matchedWaste.eco_points_per_kg || 10);

    // Локально сохраняем всегда — это гарантирует «сохраняй это для пользователя».
    state.localReports.push({
      user_id: state.userId,
      waste_type_id: matchedWaste?.id || null,
      collection_point_id: matchedPoint?.id || null,
      waste_type_name: wasteName,
      collection_point_name: pointName,
      weight_kg: weight,
      points_per_kg: pointsPerKg,
      earnedPoints: pointsPerKg * weight,
      date: new Date().toISOString()
    });
    saveLocalReports();

    try {
      await api('/reports', {
        method: 'POST',
        body: JSON.stringify({
          user_id: state.userId,
          waste_type_id: matchedWaste.id,
          collection_point_id: matchedPoint.id,
          weight_kg: weight
        })
      });
    } catch {
      // Игнорируем ошибку API: локально заявка уже сохранена
    }

    byId('report-message').textContent = 'Заявка отправлена!';
    e.target.reset();
    renderUserStats();
    await loadData();
  });
}

if (hasEl('nearest-form')) {
  byId('nearest-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const city = byId('nearest-city').value.trim().toLowerCase();
    if (!city) {
      renderPoints(state.points);
      return;
    }
    const matches = state.points.filter((p) => p.city.toLowerCase().includes(city));
    renderPoints(matches.length ? matches : state.points);
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

loadLocalReports();

const savedId = Number(localStorage.getItem('eco_user_id'));
if (savedId) {
  state.userId = savedId;
  if (hasEl('user-id')) byId('user-id').value = savedId;
  if (hasEl('profile-id')) byId('profile-id').value = savedId;
  if (hasEl('profile-message')) byId('profile-message').textContent = `Автовход: User ID ${savedId}`;
}

loadData();
