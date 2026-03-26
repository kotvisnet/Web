const state = {
  wasteTypes: [],
  points: [],
  reports: [],
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
  return state.reports.filter((r) => Number(r.user_id) === Number(state.userId));
}

function renderWasteGallery() {
  if (!hasEl('waste-gallery')) return;

  if (!state.wasteTypes.length) {
    byId('waste-gallery').innerHTML = '<p>Типы отходов пока не загружены.</p>';
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
    'Стекло: почти бесконечная переработка без потери качества.',
    'Металл: экономия энергии и природных руд.',
    'Органика: меньше метана на полигонах.'
  ];

  const fromDb = state.wasteTypes.map((w) => `${escapeHtml(w.name)}: ${escapeHtml(w.description || 'подходит для переработки и начисления баллов')}.`);
  const list = fromDb.length ? fromDb : defaultReasons;

  byId('waste-benefits').innerHTML = list.map((item) => `<li>${item}</li>`).join('');
}

function renderWasteSelect() {
  if (!hasEl('report-waste')) return;

  if (!state.wasteTypes.length) {
    byId('report-waste').innerHTML = '<option value="">Нет доступных типов отходов</option>';
    return;
  }

  byId('report-waste').innerHTML = state.wasteTypes
    .map((w) => `<option value="${w.id}">${escapeHtml(w.name)}</option>`)
    .join('');
}

function renderPoints(points = state.points) {
  if (hasEl('points-body')) {
    byId('points-body').innerHTML = points.length
      ? points.map((p) => `
          <tr>
            <td>${escapeHtml(p.name)}</td>
            <td>${escapeHtml(p.city)}</td>
            <td>${escapeHtml(p.address)}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="3">Пункты сбора пока не загружены.</td></tr>';
  }

  if (hasEl('report-point')) {
    byId('report-point').innerHTML = state.points.length
      ? state.points.map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.city)})</option>`).join('')
      : '<option value="">Нет доступных пунктов</option>';
  }
}

function renderUserStats() {
  if (!hasEl('stat-reports')) return;

  const reports = getCurrentUserReports();
  const weight = reports.reduce((sum, r) => sum + Number(r.weight_kg || 0), 0);
  const wasteMap = new Map(state.wasteTypes.map((w) => [Number(w.id), Number(w.eco_points_per_kg || 0)]));
  const points = reports.reduce((sum, r) => {
    if (r.earnedPoints !== undefined && r.earnedPoints !== null) return sum + Number(r.earnedPoints);
    const perKg = wasteMap.get(Number(r.waste_type_id)) || 0;
    return sum + perKg * Number(r.weight_kg || 0);
  }, 0);

  byId('stat-reports').textContent = fmt(reports.length);
  byId('stat-weight').textContent = fmt(weight);
  byId('stat-points').textContent = fmt(points);

  const badges = [
    { title: 'Первый отчёт', ok: reports.length >= 1 },
    { title: '10 отчётов', ok: reports.length >= 10 },
    { title: '100 кг', ok: weight >= 100 },
    { title: '1000 баллов', ok: points >= 1000 }
  ];

  if (hasEl('badge-list')) {
    byId('badge-list').innerHTML = state.userId
      ? badges.map((b) => `<span class="badge ${b.ok ? 'active' : ''}">${b.title}</span>`).join('')
      : '<span class="badge">Сначала войдите в профиль</span>';
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
      throw new Error('Сервер временно недоступен (504). Проверьте, запущен ли Node API и прокси nginx.');
    }

    if (contentType.includes('application/json')) {
      try {
        const json = JSON.parse(text);
        throw new Error(json.error || `Ошибка API: ${response.status}`);
      } catch {
        throw new Error(`Ошибка API: ${response.status}`);
      }
    }

    throw new Error(`Ошибка API: ${response.status}`);
  }

  if (!text) return null;
  if (contentType.includes('application/json')) {
    return JSON.parse(text);
  }

  return null;
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
  renderWasteSelect();
  renderPoints(state.points);
  renderUserStats();

  const errors = [wasteResult, pointsResult, reportsResult]
    .filter((r) => r.status === 'rejected')
    .map((r) => r.reason?.message)
    .filter(Boolean);

  if (errors.length) {
    const text = errors[0];
    if (hasEl('report-message')) byId('report-message').textContent = text;
    if (hasEl('profile-message')) byId('profile-message').textContent = text;
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

    try {
      await api(`/api/users/${state.userId}`, { method: 'DELETE' });
      state.userId = null;
      localStorage.removeItem('eco_user_id');
      if (hasEl('user-id')) byId('user-id').value = '';
      byId('profile-id').value = '';
      byId('profile-message').textContent = 'Аккаунт удалён.';
      renderUserStats();
    } catch (error) {
      byId('profile-message').textContent = `Не удалось удалить аккаунт: ${error.message}`;
    }
  });
}

if (hasEl('report-form')) {
  byId('report-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.userId) {
      byId('report-message').textContent = 'Сначала сохраните User ID.';
      return;
    }

    if (!state.wasteTypes.length || !state.points.length) {
      byId('report-message').textContent = 'Нет данных по отходам или пунктам. Проверьте API.';
      return;
    }

    const selectedWasteId = hasEl('manual-waste-id') && byId('manual-waste-id').value
      ? Number(byId('manual-waste-id').value)
      : Number(byId('report-waste').value);
    const selectedPointId = hasEl('manual-point-id') && byId('manual-point-id').value
      ? Number(byId('manual-point-id').value)
      : Number(byId('report-point').value);

    const payload = {
      user_id: state.userId,
      waste_type_id: selectedWasteId,
      collection_point_id: selectedPointId,
      weight_kg: Number(byId('report-weight').value)
    };


    if (!payload.waste_type_id || !payload.collection_point_id || !payload.weight_kg) {
      byId('report-message').textContent = 'Укажите тип отхода, пункт приёма и количество.';
      return;
    }
    try {
      await api('/reports', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      byId('report-message').textContent = 'Заявка отправлена!';
      e.target.reset();
      await loadData();
    } catch (error) {
      byId('report-message').textContent = `❌ ${error.message}`;
    }
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

const savedId = Number(localStorage.getItem('eco_user_id'));
if (savedId) {
  state.userId = savedId;
  if (hasEl('user-id')) byId('user-id').value = savedId;
  if (hasEl('profile-id')) byId('profile-id').value = savedId;
  if (hasEl('profile-message')) byId('profile-message').textContent = `Автовход: User ID ${savedId}`;
}

loadData();
