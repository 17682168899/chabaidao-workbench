/**
 * 配方管理（后台）
 * 数据通过统一数据层（js/db.js）读写，支持云端共享 + 实时同步。
 * 配方结构：{ id, name, cat, ingredients: [{name, qty}], steps }
 */
let CURRENT_USER = null;
let RECIPES = [];
let editingId = null;

// 转义 HTML，防 XSS
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function loadRecipes() {
  const arr = ChabaidaoDB.getRecipes();
  return Array.isArray(arr) ? arr : [];
}

function saveRecipes() {
  ChabaidaoDB.setRecipes(RECIPES);
}

function genId() {
  return 'r_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}

// 配料文本（每行「名称 用量」）→ 数组
function parseIngredients(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.split(/\s+/);
      const name = m[0];
      const qty = m.slice(1).join(' ');
      return { name, qty };
    });
}

// 数组 → 配料文本
function serializeIngredients(ings) {
  return (ings || []).map((i) => `${i.name} ${i.qty || ''}`.trim()).join('\n');
}

function renderStats() {
  document.getElementById('totalCount').textContent = RECIPES.length;
  const cats = new Set(RECIPES.map((r) => r.cat || '其他'));
  document.getElementById('catCount').textContent = cats.size;
}

function renderRecipes() {
  const list = document.getElementById('rcpList');
  renderStats();

  if (RECIPES.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="icon">📖</div><p>暂无配方，先在上方添加</p></div>';
    return;
  }

  // 按分类分组展示，保持稳定顺序
  const catOrder = ['咖啡', '真鲜奶茶·轻乳茶', '水果茶', '超人气奶茶', '其他'];
  const sorted = RECIPES.slice().sort((a, b) => {
    const ia = catOrder.indexOf(a.cat);
    const ib = catOrder.indexOf(b.cat);
    if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return a.name.localeCompare(b.name, 'zh');
  });

  list.innerHTML = sorted.map((r) => {
    const ings = (r.ingredients || []).map((i) => escapeHtml(i.name)).join('、');
    const ingCount = (r.ingredients || []).length;
    return `
      <div class="rcp-row">
        <div class="rcp-main">
          <div class="rcp-name">${escapeHtml(r.name)} <span class="mat-cat">${escapeHtml(r.cat || '其他')}</span></div>
          <div class="rcp-ings">配料 ${ingCount} 项：${ings || '—'}</div>
        </div>
        <div class="rcp-ops">
          <button class="btn-sm" onclick="editRecipe('${r.id}')">✎</button>
          <button class="btn-sm danger" onclick="delRecipe('${r.id}')">删</button>
        </div>
      </div>`;
  }).join('');
}

function saveRecipe(e) {
  e.preventDefault();
  const name = document.getElementById('rcpName').value.trim();
  const cat = document.getElementById('rcpCat').value;
  const ings = parseIngredients(document.getElementById('rcpIngs').value);
  const steps = document.getElementById('rcpSteps').value.trim();

  if (!name) {
    showToast('请输入配方名称');
    return false;
  }

  if (editingId) {
    const r = RECIPES.find((x) => x.id === editingId);
    if (r) {
      r.name = name; r.cat = cat; r.ingredients = ings; r.steps = steps;
    }
    showToast('已更新配方：' + name);
  } else {
    RECIPES.push({ id: genId(), name, cat, ingredients: ings, steps });
    showToast('已添加配方：' + name);
  }
  saveRecipes();
  renderRecipes();
  cancelEdit();
  return false;
}

function editRecipe(id) {
  const r = RECIPES.find((x) => x.id === id);
  if (!r) return;
  editingId = id;
  document.getElementById('rcpName').value = r.name || '';
  document.getElementById('rcpCat').value = r.cat || '其他';
  document.getElementById('rcpIngs').value = serializeIngredients(r.ingredients);
  document.getElementById('rcpSteps').value = r.steps || '';
  document.getElementById('formTitle').textContent = '编辑配方';
  document.getElementById('rcpSubmitBtn').textContent = '保存修改';
  document.getElementById('rcpCancelBtn').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function delRecipe(id) {
  const r = RECIPES.find((x) => x.id === id);
  if (!r) return;
  if (!confirm(`确定删除配方「${r.name}」？`)) return;
  RECIPES = RECIPES.filter((x) => x.id !== id);
  if (editingId === id) cancelEdit();
  saveRecipes();
  renderRecipes();
  showToast('已删除配方：' + r.name);
}

function cancelEdit() {
  editingId = null;
  document.getElementById('rcpForm').reset();
  document.getElementById('formTitle').textContent = '添加配方';
  document.getElementById('rcpSubmitBtn').textContent = '添加配方';
  document.getElementById('rcpCancelBtn').style.display = 'none';
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
  RECIPES = loadRecipes();
  renderRecipes();
  // 云端有其他人改动时，自动刷新配方清单（不影响正在编辑的表单）
  ChabaidaoDB.onRemoteChange(() => {
    if (editingId) return;
    RECIPES = loadRecipes();
    renderRecipes();
  });
}
init();
