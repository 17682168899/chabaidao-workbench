/**
 * 清洁管理（后台）
 * 周清任务由管理员自定义，数据通过统一数据层（js/db.js）读写，支持云端共享 + 实时同步。
 * 任务结构：{ id, area, name, note }
 */
let CURRENT_USER = null;
let TASKS = [];
let editingId = null;

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function loadTasks() {
  const arr = ChabaidaoDB.getCleanTasks();
  return Array.isArray(arr) ? arr : [];
}

function saveTasks() {
  ChabaidaoDB.setCleanTasks(TASKS);
}

function genId() {
  return 'c_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}

function renderStats() {
  document.getElementById('totalCount').textContent = TASKS.length;
  const areas = new Set(TASKS.map((t) => t.area || '其他'));
  document.getElementById('areaCount').textContent = areas.size;
}

function renderTasks() {
  const list = document.getElementById('cleanList');
  renderStats();

  if (TASKS.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="icon">🧹</div><p>暂无清洁任务，先在上方添加</p></div>';
    return;
  }

  const areaOrder = ['设备', '操作区', '后场', '环境', '其他'];
  const sorted = TASKS.slice().sort((a, b) => {
    const ia = areaOrder.indexOf(a.area);
    const ib = areaOrder.indexOf(b.area);
    if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return a.name.localeCompare(b.name, 'zh');
  });

  list.innerHTML = sorted.map((t) => `
    <div class="rcp-row">
      <div class="rcp-main">
        <div class="rcp-name">${escapeHtml(t.name)} <span class="mat-cat">${escapeHtml(t.area || '其他')}</span></div>
        <div class="rcp-ings">${escapeHtml(t.note || '—')}</div>
      </div>
      <div class="rcp-ops">
        <button class="btn-sm" onclick="editTask('${t.id}')">✎</button>
        <button class="btn-sm danger" onclick="delTask('${t.id}')">删</button>
      </div>
    </div>`).join('');
}

function saveTask(e) {
  e.preventDefault();
  const area = document.getElementById('cleanArea').value;
  const name = document.getElementById('cleanName').value.trim();
  const note = document.getElementById('cleanNote').value.trim();

  if (!name) {
    showToast('请输入任务名称');
    return false;
  }

  if (editingId) {
    const t = TASKS.find((x) => x.id === editingId);
    if (t) { t.area = area; t.name = name; t.note = note; }
    showToast('已更新任务：' + name);
  } else {
    TASKS.push({ id: genId(), area, name, note });
    showToast('已添加任务：' + name);
  }
  saveTasks();
  renderTasks();
  cancelEdit();
  return false;
}

function editTask(id) {
  const t = TASKS.find((x) => x.id === id);
  if (!t) return;
  editingId = id;
  document.getElementById('cleanArea').value = t.area || '设备';
  document.getElementById('cleanName').value = t.name || '';
  document.getElementById('cleanNote').value = t.note || '';
  document.getElementById('formTitle').textContent = '编辑清洁任务';
  document.getElementById('cleanSubmitBtn').textContent = '保存修改';
  document.getElementById('cleanCancelBtn').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function delTask(id) {
  const t = TASKS.find((x) => x.id === id);
  if (!t) return;
  if (!confirm(`确定删除任务「${t.name}」？员工端周清清单将同步移除。`)) return;
  TASKS = TASKS.filter((x) => x.id !== id);
  if (editingId === id) cancelEdit();
  saveTasks();
  renderTasks();
  showToast('已删除任务：' + t.name);
}

function cancelEdit() {
  editingId = null;
  document.getElementById('cleanForm').reset();
  document.getElementById('formTitle').textContent = '添加清洁任务';
  document.getElementById('cleanSubmitBtn').textContent = '添加任务';
  document.getElementById('cleanCancelBtn').style.display = 'none';
}

function goManagement() {
  window.location.href = 'management.html';
}

function doLogout() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = 'login.html';
}

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

async function init() {
  await ChabaidaoDB.ready();
  CURRENT_USER = requireLogin('admin');
  if (!CURRENT_USER) return;
  TASKS = loadTasks();
  renderTasks();
  // 云端有其他人改动时，自动刷新任务清单（不影响正在编辑的表单）
  ChabaidaoDB.onRemoteChange(() => {
    if (editingId) return;
    TASKS = loadTasks();
    renderTasks();
  });
}
init();
