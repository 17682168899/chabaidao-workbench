/**
 * 物料管理
 * 数据通过统一数据层（js/db.js）读写，支持云端共享 + 实时同步
 */
let CURRENT_USER = null;
let MATERIALS = [];

// 转义 HTML，防止物料名/文档内容造成的 XSS
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function loadMaterials() {
  const arr = ChabaidaoDB.getMaterials();
  if (arr === null || arr === undefined) {
    const def = defaultMaterials();
    ChabaidaoDB.setMaterials(def);
    return def;
  }
  return arr;
}

function saveMaterials() {
  ChabaidaoDB.setMaterials(MATERIALS);
}

function defaultMaterials() {
  return [
    { id: 'mat_1', name: '珍珠', category: '配料', stock: 12, unit: 'kg', warnLine: 5 },
    { id: 'mat_2', name: '红茶', category: '茶叶', stock: 8, unit: 'kg', warnLine: 3 },
    { id: 'mat_3', name: '牛奶', category: '奶类', stock: 18, unit: 'L', warnLine: 8 },
    { id: 'mat_4', name: '果糖', category: '糖浆', stock: 15, unit: 'kg', warnLine: 5 },
    { id: 'mat_5', name: '杯子', category: '包材', stock: 480, unit: '个', warnLine: 120 },
    { id: 'mat_6', name: '柠檬', category: '水果', stock: 6, unit: 'kg', warnLine: 4 },
  ];
}

function renderMaterials() {
  const list = document.getElementById('matList');
  const warns = MATERIALS.filter((m) => m.stock <= m.warnLine).length;
  document.getElementById('totalCount').textContent = MATERIALS.length;
  document.getElementById('warnCount').textContent = warns;

  if (MATERIALS.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="icon">📦</div><p>暂无物料，先在上方添加</p></div>';
    return;
  }

  const sorted = MATERIALS.slice().sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });

  let html = '';
  sorted.forEach((m) => {
    const warn = m.stock <= m.warnLine;
    html += `
      <div class="mat-row ${warn ? 'warn' : ''}">
        <div class="mat-info">
          <div class="mat-name">${escapeHtml(m.name)} <span class="mat-cat">${escapeHtml(m.category)}</span></div>
          <div class="mat-stock">库存 <strong>${m.stock}</strong> ${escapeHtml(m.unit)} ${warn ? '<span class="warn-tag">⚠ 库存预警</span>' : ''}</div>
        </div>
        <div class="mat-ops">
          <button class="btn-sm" onclick="adjustStock('${m.id}', -1)">−</button>
          <button class="btn-sm" onclick="adjustStock('${m.id}', 1)">＋</button>
          <button class="btn-sm danger" onclick="delMaterial('${m.id}')">删</button>
        </div>
      </div>
    `;
  });
  list.innerHTML = html;
}

function addMaterial(e) {
  e.preventDefault();
  const name = document.getElementById('matName').value.trim();
  const category = document.getElementById('matCategory').value;
  const unit = document.getElementById('matUnit').value.trim() || '份';
  const warnLine = parseFloat(document.getElementById('matWarn').value) || 0;
  if (!name) {
    showToast('请输入物料名称');
    return false;
  }
  MATERIALS.push({
    id: 'mat_' + Date.now(),
    name, category, stock: 0, unit, warnLine,
  });
  saveMaterials();
  renderMaterials();
  document.getElementById('addForm').reset();
  document.getElementById('matUnit').value = '份';
  document.getElementById('matWarn').value = '5';
  showToast('已添加物料：' + name);
  return false;
}

function adjustStock(id, delta) {
  const m = MATERIALS.find((x) => x.id === id);
  if (!m) return;
  m.stock = Math.max(0, m.stock + delta);
  saveMaterials();
  renderMaterials();
}

function delMaterial(id) {
  const m = MATERIALS.find((x) => x.id === id);
  if (!m) return;
  if (!confirm(`确定删除物料「${m.name}」？`)) return;
  MATERIALS = MATERIALS.filter((x) => x.id !== id);
  saveMaterials();
  renderMaterials();
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

/* ============================
   文档识别：上传 / 粘贴 → 解析物料 → 导入
   ============================ */
let parsedDocMaterials = [];

const DOC_UNITS = ['kg','公斤','千克','g','克','mg','毫克','l','升','毫升','ml','斤',
  '份','个','只','包','袋','箱','瓶','杯','桶','盒','听','块','条','根'];
const DOC_CATEGORIES = ['茶叶','奶类','糖浆','配料','包材','水果','其他'];

function openDocModal() {
  parsedDocMaterials = [];
  document.getElementById('docModal').classList.add('show');
  document.getElementById('docFile').value = '';
  document.getElementById('docText').value = '';
  document.getElementById('docPreview').innerHTML =
    '<div class="empty-state"><div class="icon">🔍</div><p>上传或粘贴文档后将在此预览识别结果</p></div>';
  document.getElementById('docImportBtn').disabled = true;
}

function closeDocModal() {
  document.getElementById('docModal').classList.remove('show');
}

function onDocFileChange() {
  const fileInput = document.getElementById('docFile');
  if (!fileInput.files || !fileInput.files.length) return;
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('docText').value = e.target.result;
    parseDocText(e.target.result);
  };
  reader.onerror = () => showToast('文件读取失败');
  reader.readAsText(file, 'utf-8');
}

function onDocTextInput() {
  parseDocText(document.getElementById('docText').value);
}

// 解析整段文本：按行处理
function parseDocText(text) {
  const lines = String(text || '').split(/\r?\n/);
  const result = [];
  lines.forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    const item = parseOneLine(line);
    if (item) { item.include = true; result.push(item); }
  });
  parsedDocMaterials = result;
  renderDocPreview(result);
}

// 解析单行：名称 数量 单位 分类（分隔符支持空格 / 逗号 / 制表符 / 分号）
function parseOneLine(line) {
  // 去掉行首序号 / 项目符号：1. 1) 1、 - • · *
  const cleaned = line.replace(/^[\s]*([0-9]+[\.\)、]|[-–—•·*])\s*/, '');
  const normalized = cleaned.replace(/[，,;\t]/g, ' ');
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;

  const name = tokens[0];
  let stock = 0;
  let unit = '';
  let category = '';

  tokens.slice(1).forEach((tok) => {
    const isNum = /^[0-9]+(\.[0-9]+)?$/.test(tok);
    if (isNum && stock === 0) {
      stock = parseFloat(tok);
    } else if (!unit && DOC_UNITS.includes(tok.toLowerCase())) {
      unit = tok;
    } else if (!category && DOC_CATEGORIES.includes(tok)) {
      category = tok;
    }
  });

  if (!name) return null;
  return { name, stock, unit, category };
}

function renderDocPreview(items) {
  const box = document.getElementById('docPreview');
  const btn = document.getElementById('docImportBtn');
  if (!items.length) {
    box.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><p>未识别到物料，请检查文档格式</p></div>';
    btn.disabled = true;
    return;
  }
  let html = '';
  items.forEach((it, i) => {
    const meta = [it.stock ? it.stock + ' ' : '', it.unit || '', it.category || ''].join(' ').trim();
    html += `
      <label class="doc-prev-row">
        <input type="checkbox" ${it.include ? 'checked' : ''} onchange="toggleDocItem(${i}, this.checked)">
        <span class="dp-name">${escapeHtml(it.name)}</span>
        <span class="dp-meta">${escapeHtml(meta)}</span>
      </label>
    `;
  });
  box.innerHTML = html;
  btn.disabled = items.length === 0;
}

function toggleDocItem(i, checked) {
  if (parsedDocMaterials[i]) parsedDocMaterials[i].include = checked;
}

function importDocMaterials() {
  let added = 0;
  let skipped = 0;
  const existing = new Set(MATERIALS.map((m) => m.name.toLowerCase()));
  parsedDocMaterials.forEach((item) => {
    if (!item.include || !item.name) return;
    const key = item.name.toLowerCase();
    if (existing.has(key)) { skipped++; return; }
    MATERIALS.push({
      id: 'mat_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: item.name,
      category: item.category || '其他',
      stock: Number(item.stock) || 0,
      unit: item.unit || '份',
      warnLine: item.stock ? Math.max(1, Math.ceil(item.stock * 0.3)) : 5,
    });
    existing.add(key);
    added++;
  });
  saveMaterials();
  renderMaterials();
  closeDocModal();
  showToast(`已导入 ${added} 项，跳过重复 ${skipped} 项`);
}

// 事件绑定
document.getElementById('docFile').addEventListener('change', onDocFileChange);
document.getElementById('docText').addEventListener('input', onDocTextInput);

const docDrop = document.getElementById('docDrop');
['dragenter', 'dragover'].forEach((ev) =>
  docDrop.addEventListener(ev, (e) => { e.preventDefault(); docDrop.classList.add('drag'); }));
docDrop.addEventListener('dragleave', () => docDrop.classList.remove('drag'));
docDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  docDrop.classList.remove('drag');
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev2) => {
    document.getElementById('docText').value = ev2.target.result;
    parseDocText(ev2.target.result);
  };
  reader.readAsText(file, 'utf-8');
});

// 初始化：等数据层就绪（本地或云端）后再渲染
async function init() {
  await ChabaidaoDB.ready();
  CURRENT_USER = requireLogin('admin');
  if (!CURRENT_USER) return; // 未登录，已跳转登录页
  MATERIALS = loadMaterials();
  renderMaterials();
  // 云端有其他人改动时，自动刷新物料列表
  ChabaidaoDB.onRemoteChange(() => {
    MATERIALS = loadMaterials();
    renderMaterials();
  });
}
init();
