/**
 * 茶百道工作台 - 员工管理（管理员）
 */

let DATA = null;
let CURRENT_USER = null;
let modalConfirmCb = null;

async function init() {
  await ChabaidaoDB.ready();
  CURRENT_USER = requireLogin('admin');
  if (!CURRENT_USER) return;
  DATA = loadData();

  document.getElementById('userAvatar').textContent = CURRENT_USER.name.charAt(0);
  document.getElementById('userName').textContent = CURRENT_USER.name;

  renderList();
  // 云端有改动时刷新员工列表
  ChabaidaoDB.onRemoteChange(() => {
    if (!CURRENT_USER) return;
    renderList();
  });
}

function renderList() {
  // 重新加载最新数据
  DATA = loadData();
  const list = document.getElementById('empList');
  if (DATA.employees.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="icon">👥</div><p>暂无员工，请添加</p></div>';
    return;
  }

  let html = '';
  // 管理员排前面
  const sorted = DATA.employees.slice().sort((a, b) => {
    if (a.role === b.role) return 0;
    return a.role === 'admin' ? -1 : 1;
  });
  sorted.forEach((emp) => {
    const isSelf = emp.id === CURRENT_USER.id;
    html += `
      <div class="emp-row ${emp.role === 'admin' ? 'admin' : ''}">
        <div class="avatar">${emp.name.charAt(0)}</div>
        <div class="info">
          <div class="nm">
            ${emp.name}
            ${emp.role === 'admin' ? '<span class="tag">管理员</span>' : ''}
            ${isSelf ? '<span class="tag" style="background:#4A90E2;">我</span>' : ''}
          </div>
          <div class="meta">${emp.position || '未设置岗位'} · 账号 ${emp.username}</div>
        </div>
        <div class="ops">
          <button title="编辑" onclick="openEditSheet('${emp.id}')">✏️</button>
          <button title="重置密码" onclick="confirmResetPwd('${emp.id}')">🔑</button>
          <button title="删除" class="danger" onclick="confirmDelete('${emp.id}')" ${isSelf ? 'disabled style="opacity:0.3;"' : ''}>🗑</button>
        </div>
      </div>
    `;
  });
  list.innerHTML = html;
}

/* ============== 添加/编辑弹层 ============== */

function openAddSheet() {
  document.getElementById('sheetTitle').textContent = '添加员工';
  document.getElementById('editId').value = '';
  document.getElementById('fName').value = '';
  document.getElementById('fPosition').value = '';
  document.getElementById('fUsername').value = '';
  document.getElementById('fPassword').value = '';
  document.getElementById('fPassword').placeholder = '初始密码';
  document.getElementById('pwdLabel').textContent = '密码';
  document.querySelector('input[name="fRole"][value="staff"]').checked = true;
  showSheet();
}

function openEditSheet(empId) {
  const emp = findEmployee(DATA, empId);
  if (!emp) return;
  document.getElementById('sheetTitle').textContent = '编辑员工';
  document.getElementById('editId').value = emp.id;
  document.getElementById('fName').value = emp.name;
  document.getElementById('fPosition').value = emp.position || '';
  document.getElementById('fUsername').value = emp.username;
  document.getElementById('fPassword').value = emp.password;
  document.getElementById('fPassword').placeholder = '密码';
  document.getElementById('pwdLabel').textContent = '密码';
  document.querySelector(`input[name="fRole"][value="${emp.role}"]`).checked = true;
  showSheet();
}

function showSheet() {
  document.getElementById('formSheet').classList.add('show');
}
function closeSheet() {
  document.getElementById('formSheet').classList.remove('show');
}

function submitForm() {
  const editId = document.getElementById('editId').value;
  const name = document.getElementById('fName').value.trim();
  const position = document.getElementById('fPosition').value.trim();
  const username = document.getElementById('fUsername').value.trim();
  const password = document.getElementById('fPassword').value;
  const role = document.querySelector('input[name="fRole"]:checked').value;

  let result;
  if (editId) {
    result = updateEmployee(DATA, editId, { name, position, username, password, role });
  } else {
    result = addEmployee(DATA, { name, position, username, password, role });
  }

  if (!result.ok) {
    showToast('❌ ' + result.error);
    return;
  }
  closeSheet();
  renderList();
  showToast(editId ? '✓ 已更新员工信息' : '✓ 已添加员工');
}

/* ============== 重置密码 ============== */

function confirmResetPwd(empId) {
  const emp = findEmployee(DATA, empId);
  if (!emp) return;
  showModal(
    '重置密码',
    `将「${emp.name}」的密码重置为 123456？`,
    () => {
      const r = resetEmployeePassword(DATA, empId, '123456');
      if (r.ok) showToast('✓ 密码已重置为 123456');
      else showToast('❌ ' + r.error);
      renderList();
    }
  );
}

/* ============== 删除员工 ============== */

function confirmDelete(empId) {
  const emp = findEmployee(DATA, empId);
  if (!emp) return;
  if (emp.id === CURRENT_USER.id) {
    showToast('❌ 不能删除当前登录账号');
    return;
  }
  showModal(
    '删除员工',
    `确定删除「${emp.name}」？该员工的所有排班数据将一并清除，此操作不可恢复。`,
    () => {
      const r = deleteEmployee(DATA, empId);
      if (r.ok) {
        showToast('✓ 已删除员工');
        renderList();
      } else {
        showToast('❌ ' + r.error);
      }
    }
  );
}

/* ============== 模态框 ============== */

function showModal(title, body, onConfirm) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').textContent = body;
  modalConfirmCb = onConfirm;
  document.getElementById('modal').classList.add('show');
}

function closeModal() {
  document.getElementById('modal').classList.remove('show');
}

document.getElementById('modalConfirm').onclick = () => {
  document.getElementById('modal').classList.remove('show');
  if (modalConfirmCb) modalConfirmCb();
};

/* ============== Toast ============== */

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ============== 导航 ============== */

function goBack() {
  window.location.href = 'admin.html';
}

// 启动
init();