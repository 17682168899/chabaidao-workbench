/* 设置页逻辑 */

let DATA = null;
let toastTimer = null;

function init() {
  requireLogin('admin');
  DATA = loadData();
  renderUserBar();
  loadSettings();
}

function renderUserBar() {
  const user = getCurrentUser();
  if (user) {
    const nameEl = document.getElementById('userName');
    const avatarEl = document.getElementById('userAvatar');
    if (nameEl) nameEl.textContent = user.name;
    if (avatarEl) avatarEl.textContent = user.role === 'admin' ? '👑' : '👤';
  }
}

function loadSettings() {
  const settings = getBusinessSettings(DATA);
  const startEl = document.getElementById('businessStart');
  const endEl = document.getElementById('businessEnd');
  const intervalEl = document.getElementById('slotInterval');
  if (startEl) startEl.value = settings.businessStart || '07:00';
  if (endEl) endEl.value = settings.businessEnd || '00:00';
  if (intervalEl) intervalEl.value = String(settings.slotInterval || 30);
}

function saveSettings() {
  const startEl = document.getElementById('businessStart');
  const endEl = document.getElementById('businessEnd');
  const intervalEl = document.getElementById('slotInterval');

  const businessStart = startEl.value || '07:00';
  const businessEnd = endEl.value || '00:00';
  const slotInterval = parseInt(intervalEl.value, 10) || 30;

  const toMinutes = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  let startMin = toMinutes(businessStart);
  let endMin = toMinutes(businessEnd);
  // 结束时间早于开始时间时，视为次日（跨天营业），如 07:00 -> 次日 02:00
  if (endMin <= startMin) {
    endMin += 24 * 60;
  }

  saveBusinessSettings(DATA, { businessStart, businessEnd, slotInterval });
  showToast('✓ 设置已保存');
}

function goEmployees() {
  window.location.href = 'admin-employees.html';
}

function goBack() {
  window.location.href = 'admin.html';
}

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

init();
