const state = {
  wasteTypes: [],
  points: [],
  reports: [],
  userId: null
};

const images = {
  plastic: '/images/plastic.svg',
  paper: '/images/paper.svg',
  glass: '/images/glass.svg',
  metal: '/images/metal.svg',
  organic: '/images/organic.svg',
  default: '/images/organic.svg'
};

const byId = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const pages = ['welcome', 'dropoff', 'info', 'profile'];

function getImage(name = '', description = '') {
  const text = `${name} ${description}`.toLowerCase();
  if (text.includes('пласт') || text.includes('plastic')) return images.plastic;
  if (text.includes('бумаг') || text.includes('paper') || text.includes('картон')) return images.paper;
  if (text.includes('стекл') || text.includes('glass')) return images.glass;
  if (text.includes('металл') || text.includes('metal')) return images.metal;
  if (text.includes('орган') || text.includes('био') || text.includes('food')) return images.organic;
  return images.default;
}

function setPage(page) {
  const safePage = pages.includes(page) ? page : 'welcome';
  document.querySelectorAll('.page').forEach((p) => {
    p.classList.toggle('active', p.dataset.page === safePage);
  });
  window.location.hash = safePage;
}

function getCurrentUserReports() {
  if (!state.userId) return [];
  return state.reports.filter((r) => Number(r.user_id) === Number(state.userId));
}

function renderWasteGallery() {
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

  byId('report-waste').innerHTML = state.wasteTypes
    .map((w) => `<option value="${w.id}">${escapeHtml(w.name)}</option>`)
    .join('');
}

function renderPoints(points = state.points) {
  byId('points-body').innerHTML = points.map((p) => `
    <tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.city)}</td>
      <td>${escapeHtml(p.address)}</td>
    </tr>
  `).join('');

  byId('report-point').innerHTML = state.points
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.city)})</option>`)
    .join('');
}

function renderUserStats() {
  const reports = getCurrentUserReports();
  const weight = reports.reduce((sum, r) => sum + Number(r.weight_kg || 0), 0);
  const points = reports.reduce((sum, r) => sum + Number(r.earnedPoints || 0), 0);

  byId('stat-reports').textContent = fmt(reports.length);
  byId('stat-weight').textContent = fmt(weight);
  byId('stat-points').textContent = fmt(points);

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

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Ошибка API: ${response.status}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function loadData() {
  const [wasteTypes, points, reports] = await Promise.all([
    api('/waste-types'),
    api('/collection-points'),
    api('/reports')
  ]);

  state.wasteTypes = wasteTypes;
  state.points = points;
  state.reports = reports;

  renderWasteGallery();
  renderPoints();
  renderUserStats();
}

byId('go-dropoff').addEventListener('click', () => setPage('dropoff'));
byId('go-info').addEventListener('click', () => setPage('info'));
byId('go-profile').addEventListener('click', () => setPage('profile'));

document.querySelectorAll('[data-route]').forEach((btn) => {
  btn.addEventListener('click', () => setPage(btn.dataset.route));
});

byId('user-form').addEventListener('submit', (e) => {
  e.preventDefault();
  state.userId = Number(byId('user-id').value);
  byId('profile-id').value = state.userId;
  localStorage.setItem('eco_user_id', String(state.userId));
  byId('report-message').textContent = 'User ID сохранён.';
  renderUserStats();
});

byId('profile-form').addEventListener('submit', (e) => {
  e.preventDefault();
  state.userId = Number(byId('profile-id').value);
  byId('user-id').value = state.userId;
  localStorage.setItem('eco_user_id', String(state.userId));
  byId('profile-message').textContent = `Вход выполнен: User ID ${state.userId}`;
  renderUserStats();
});

byId('delete-account').addEventListener('click', async () => {
  if (!state.userId) {
    byId('profile-message').textContent = 'Сначала войдите в профиль.';
    return;
  }

  if (!confirm('Удалить аккаунт и данные пользователя?')) return;

  try {
    await api(`/users/${state.userId}`, { method: 'DELETE' });
    state.userId = null;
    localStorage.removeItem('eco_user_id');
    byId('user-id').value = '';
    byId('profile-id').value = '';
    byId('profile-message').textContent = 'Аккаунт удалён.';
    renderUserStats();
  } catch (error) {
    byId('profile-message').textContent = `Не удалось удалить аккаунт: ${error.message}`;
  }
});

byId('report-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.userId) {
    byId('report-message').textContent = 'Сначала сохраните User ID.';
    return;
  }

  const payload = {
    user_id: state.userId,
    waste_type_id: Number(byId('report-waste').value),
    collection_point_id: Number(byId('report-point').value),
    weight_kg: Number(byId('report-weight').value)
  };

  try {
    const result = await api('/reports', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    byId('report-message').textContent = `✅ Успешно! Начислено ${fmt(result.earnedPoints)} баллов.`;
    e.target.reset();
    await loadData();
  } catch (error) {
    byId('report-message').textContent = `❌ ${error.message}`;
  }
});

byId('nearest-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const city = byId('nearest-city').value.trim().toLowerCase();
  const matches = state.points.filter((p) => p.city.toLowerCase().includes(city));
  renderPoints(matches.length ? matches : state.points);
});

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
  byId('user-id').value = savedId;
  byId('profile-id').value = savedId;
  byId('profile-message').textContent = `Автовход: User ID ${savedId}`;
}

const hashPage = window.location.hash.replace('#', '') || 'welcome';
setPage(hashPage);

loadData().catch((error) => {
  byId('report-message').textContent = error.message;
});
