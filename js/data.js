/**
 * 茶百道工作台 - 数据管理层
 * 数据持久化：localStorage
 *
 * 排班数据结构：
 *  - 时间网格：根据 settings.businessStart ~ settings.businessEnd，每 slotInterval 分钟一格
 *  - 每天每位员工的排班用一个对应长度的数组表示，元素值：
 *      0 = 未排（空），1 = 考勤/工作（蓝色），2 = 休息（黄色）
 *
 * 账号系统：
 *  - 每位员工有 username / password / position 字段
 *  - role: 'staff'（员工）| 'admin'（管理员）
 *  - 登录态保存在 sessionStorage（关闭标签页即失效）
 */

const STORAGE_KEY = 'chabadao_workbench_v1';
const SESSION_KEY = 'chabadao_login_emp_id';

/* ============== 时间/时段工具 ============== */

function parseTimeToMinutes(time) {
  const [h, m] = String(time).split(':').map(Number);
  return h * 60 + m;
}

function formatMinutesToTime(minutes) {
  // 跨天零点（如 24:00）显示为 00:00
  minutes = minutes % (24 * 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getSlotSettings(settings) {
  const s = settings || DEFAULT_SETTINGS;
  let startMin = parseTimeToMinutes(s.businessStart);
  let endMin = parseTimeToMinutes(s.businessEnd);
  // 结束时间早于开始时间时，视为次日（跨天营业），如 07:00 -> 次日 02:00
  if (endMin <= startMin) endMin += 24 * 60;
  const interval = parseInt(s.slotInterval, 10) || 30;
  // 每个 slot 代表一个时段区间（如 07:00-07:30），count 为区间数量
  const count = Math.max(1, Math.round((endMin - startMin) / interval));
  return { startMin, endMin, interval, count };
}

function getSlotCount(settings) {
  return getSlotSettings(settings).count;
}

function getTimeSlots(settings) {
  const { startMin, interval, count } = getSlotSettings(settings);
  const slots = [];
  for (let i = 1; i <= count; i++) {
    slots.push(formatMinutesToTime(startMin + i * interval));
  }
  return slots;
}

function getSlotLabels(settings) {
  const { startMin, interval, count } = getSlotSettings(settings);
  const labels = [];
  for (let i = 1; i <= count; i++) {
    labels.push(formatMinutesToTime(startMin + i * interval));
  }
  return labels;
}

function normalizeSlots(slots, settings) {
  const count = getSlotCount(settings);
  if (!Array.isArray(slots)) return new Array(count).fill(0);
  if (slots.length === count) return slots.slice();
  const arr = new Array(count).fill(0);
  for (let i = 0; i < Math.min(slots.length, count); i++) {
    arr[i] = slots[i];
  }
  return arr;
}

// 默认员工数据（含账号密码，演示用，密码统一 123456）
const DEFAULT_EMPLOYEES = [
  { id: 'emp_jmd', name: '金梦迪', role: 'staff', position: '店员', username: 'jmd', password: '123456' },
  { id: 'emp_cyy', name: '陈芸芸', role: 'staff', position: '店员', username: 'cyy', password: '123456' },
  { id: 'emp_wyc', name: '王颖程', role: 'staff', position: '值班经理', username: 'wyc', password: '123456' },
  { id: 'emp_zwq', name: '朱万芹', role: 'staff', position: '店员', username: 'zwq', password: '123456' },
  { id: 'emp_kxq', name: '孔叙千', role: 'staff', position: '店员', username: 'kxq', password: '123456' },
  { id: 'emp_mxm', name: '马晓梅', role: 'staff', position: '店员', username: 'mxm', password: '123456' },
  { id: 'emp_tza', name: '田梓傲', role: 'staff', position: '店员', username: 'tza', password: '123456' },
  { id: 'emp_admin', name: '店长', role: 'admin', position: '店长', username: 'admin', password: '123456' },
];

// 默认营业设置
const DEFAULT_SETTINGS = {
  businessStart: '07:00',
  businessEnd: '00:00',
  slotInterval: 30,
};

// 旧版员工 id -> 默认用户名映射（用于数据迁移）
const LEGACY_USERNAME_MAP = {
  emp_jmd: 'jmd',
  emp_cyy: 'cyy',
  emp_wyc: 'wyc',
  emp_zwq: 'zwq',
  emp_kxq: 'kxq',
  emp_mxm: 'mxm',
  emp_tza: 'tza',
  emp_admin: 'admin',
};

/**
 * 默认排班数据（演示用）
 */
function buildDefaultSchedules(settings) {
  const monday = getMondayOfThisWeek();
  const mondayStr = formatDate(monday);
  const { startMin, interval, count } = getSlotSettings(settings);
  const schedules = {};
  for (let d = 0; d < 7; d++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + d);
    const key = formatDate(date);
    schedules[key] = {};
    DEFAULT_EMPLOYEES.forEach((emp, idx) => {
      const startHour = 8 + (idx % 4);
      const workHours = 4 + ((idx + d) % 5);
      const arr = new Array(count).fill(0);
      const startSlot = Math.round((startHour * 60 - startMin) / interval);
      for (let h = 0; h < workHours; h++) {
        const slotIdx = startSlot + Math.round(h * 60 / interval);
        if (slotIdx >= 0 && slotIdx < count) arr[slotIdx] = 1;
      }
      schedules[key][emp.id] = {
        slots: arr,
        updatedAt: new Date().toISOString(),
      };
    });
  }
  return { monday: mondayStr, schedules };
}

/* ============== 日期工具 ============== */

function getMondayOfThisWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getWeekDates(mondayDate) {
  const arr = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mondayDate);
    d.setDate(mondayDate.getDate() + i);
    arr.push(d);
  }
  return arr;
}

/* ============== 数据加载/保存 ============== */

/**
 * 旧数据迁移：为缺少账号字段的员工补充默认 username/password/position
 */
function migrateData(data) {
  if (!data || !Array.isArray(data.employees)) return data;
  let changed = false;
  data.employees.forEach((emp) => {
    if (!emp.username) {
      emp.username = LEGACY_USERNAME_MAP[emp.id] || ('emp_' + emp.id.slice(-3));
      changed = true;
    }
    if (emp.password === undefined) {
      emp.password = '123456';
      changed = true;
    }
    if (emp.position === undefined) {
      emp.position = emp.role === 'admin' ? '店长' : '店员';
      changed = true;
    }
    // 清理旧数据中名字里自动添加的「（管理员）」后缀
    if (emp.name && /[（(]管理员[)）]/.test(emp.name)) {
      emp.name = emp.name.replace(/\s*[（(]管理员[)）]\s*/g, '').trim();
      changed = true;
    }
  });
  // 确保至少有一个管理员
  if (!data.employees.some((e) => e.role === 'admin')) {
    data.employees.push({
      id: 'emp_admin',
      name: '店长',
      role: 'admin',
      position: '店长',
      username: 'admin',
      password: '123456',
    });
    changed = true;
  }
  // 确保 settings 存在
  if (!data.settings) {
    data.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    changed = true;
  } else {
    Object.keys(DEFAULT_SETTINGS).forEach((key) => {
      if (data.settings[key] === undefined) {
        data.settings[key] = DEFAULT_SETTINGS[key];
        changed = true;
      }
    });
  }
  if (changed) saveData(data);
  return data;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      const def = buildDefaultSchedules(settings);
      const data = {
        employees: JSON.parse(JSON.stringify(DEFAULT_EMPLOYEES)),
        currentWeek: def.monday,
        schedules: def.schedules,
        settings,
      };
      saveData(data);
      return data;
    }
    return migrateData(JSON.parse(raw));
  } catch (e) {
    console.error('加载数据失败：', e);
    return null;
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getBusinessSettings(data) {
  if (!data || !data.settings) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  return { ...DEFAULT_SETTINGS, ...data.settings };
}

function saveBusinessSettings(data, settings) {
  data.settings = { ...getBusinessSettings(data), ...settings };
  saveData(data);
}

function resetData() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  return loadData();
}

/* ============== 排班读写 ============== */

function getSchedule(data, employeeId, dateStr) {
  const day = data.schedules[dateStr];
  if (!day || !day[employeeId]) return new Array(getSlotCount(data.settings)).fill(0);
  return normalizeSlots(day[employeeId].slots, data.settings);
}

function setSchedule(data, employeeId, dateStr, slots) {
  if (!data.schedules[dateStr]) data.schedules[dateStr] = {};
  data.schedules[dateStr][employeeId] = {
    slots: slots.slice(),
    updatedAt: new Date().toISOString(),
  };
  saveData(data);
}

/* ============== 工时统计 ============== */

function calcWorkHours(slots, intervalMinutes) {
  const interval = intervalMinutes || 30;
  let count = 0;
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] === 1) count++;
  }
  return count * (interval / 60);
}

function calcWeekHours(data, employeeId, mondayDate) {
  let total = 0;
  const interval = getBusinessSettings(data).slotInterval;
  const dates = getWeekDates(mondayDate);
  dates.forEach((d) => {
    total += calcWorkHours(getSchedule(data, employeeId, formatDate(d)), interval);
  });
  return total;
}

function shiftWeek(mondayStr, weeks) {
  const d = parseDate(mondayStr);
  d.setDate(d.getDate() + weeks * 7);
  return formatDate(d);
}

function findEmployee(data, empId) {
  return data.employees.find((e) => e.id === empId);
}

/* ============== 账号 & 登录 ============== */

/**
 * 登录验证：返回 employee 对象或 null
 */
function login(data, username, password) {
  const emp = data.employees.find(
    (e) => e.username === username && e.password === password
  );
  if (emp) {
    sessionStorage.setItem(SESSION_KEY, emp.id);
    return emp;
  }
  return null;
}

/**
 * 退出登录
 */
function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * 获取当前登录用户对象（未登录返回 null）
 */
function getCurrentUser(data) {
  const empId = sessionStorage.getItem(SESSION_KEY);
  if (!empId) return null;
  return data.employees.find((e) => e.id === empId) || null;
}

/**
 * 登录守卫：页面加载时调用
 *  - 未登录 → 跳转 login.html
 *  - 已登录但角色不匹配 → 跳转到对应首页
 * 返回当前用户对象
 */
function requireLogin(expectedRole) {
  const data = loadData();
  const user = getCurrentUser(data);
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  if (expectedRole && user.role !== expectedRole) {
    // 角色不匹配，跳到对应的工作台
    window.location.href = user.role === 'admin' ? 'admin.html' : 'employee.html';
    return null;
  }
  return user;
}

/* ============== 员工管理（管理员） ============== */

/**
 * 生成新员工 id
 */
function genEmployeeId(data) {
  let max = 0;
  data.employees.forEach((e) => {
    const m = /^emp_(\d+)$/.exec(e.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return 'emp_' + String(max + 1).padStart(4, '0');
}

/**
 * 检查用户名是否被占用（可排除某个员工 id）
 */
function isUsernameTaken(data, username, excludeId) {
  return data.employees.some(
    (e) => e.username === username && e.id !== excludeId
  );
}

/**
 * 添加员工
 *  - name: 姓名（必填）
 *  - username: 登录账号（必填，唯一）
 *  - password: 密码（必填）
 *  - role: 'staff' | 'admin'（默认 staff）
 *  - position: 岗位（可选，默认根据角色）
 * 返回 { ok, emp, error }
 */
function addEmployee(data, { name, username, password, role, position }) {
  name = (name || '').trim();
  username = (username || '').trim();
  password = password || '';
  role = role === 'admin' ? 'admin' : 'staff';
  position = (position || '').trim() || (role === 'admin' ? '店长' : '店员');

  if (!name) return { ok: false, error: '请填写姓名' };
  if (!username) return { ok: false, error: '请填写登录账号' };
  if (!password) return { ok: false, error: '请填写密码' };
  if (isUsernameTaken(data, username)) {
    return { ok: false, error: '账号已被占用' };
  }

  const emp = {
    id: genEmployeeId(data),
    name,
    username,
    password,
    role,
    position,
  };
  data.employees.push(emp);
  saveData(data);
  return { ok: true, emp };
}

/**
 * 更新员工信息
 *  - 可修改 name / username / password / role / position
 *  - username 修改时检查唯一性
 */
function updateEmployee(data, empId, updates) {
  const emp = findEmployee(data, empId);
  if (!emp) return { ok: false, error: '员工不存在' };

  if (updates.username !== undefined) {
    const u = updates.username.trim();
    if (!u) return { ok: false, error: '账号不能为空' };
    if (isUsernameTaken(data, u, empId)) {
      return { ok: false, error: '账号已被占用' };
    }
    emp.username = u;
  }
  if (updates.name !== undefined) {
    const n = updates.name.trim();
    if (!n) return { ok: false, error: '姓名不能为空' };
    emp.name = n;
  }
  if (updates.position !== undefined) {
    const p = updates.position.trim();
    if (!p) return { ok: false, error: '岗位不能为空' };
    emp.position = p;
  }
  if (updates.password !== undefined) {
    if (!updates.password) return { ok: false, error: '密码不能为空' };
    emp.password = updates.password;
  }
  if (updates.role !== undefined) {
    emp.role = updates.role === 'admin' ? 'admin' : 'staff';
  }
  saveData(data);
  return { ok: true, emp };
}

/**
 * 删除员工（同时清除其所有排班数据）
 *  - 不允许删除最后一个管理员
 */
function deleteEmployee(data, empId) {
  const emp = findEmployee(data, empId);
  if (!emp) return { ok: false, error: '员工不存在' };

  if (emp.role === 'admin') {
    const adminCount = data.employees.filter((e) => e.role === 'admin').length;
    if (adminCount <= 1) {
      return { ok: false, error: '至少保留一个管理员账号，无法删除' };
    }
  }

  data.employees = data.employees.filter((e) => e.id !== empId);
  // 清除该员工的所有排班
  Object.keys(data.schedules).forEach((dateKey) => {
    if (data.schedules[dateKey][empId]) {
      delete data.schedules[dateKey][empId];
    }
  });
  saveData(data);
  return { ok: true };
}

/**
 * 重置员工密码
 */
function resetEmployeePassword(data, empId, newPassword) {
  if (!newPassword) return { ok: false, error: '密码不能为空' };
  return updateEmployee(data, empId, { password: newPassword });
}