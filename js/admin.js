/**
 * 茶百道工作台 - 管理员端逻辑
 *
 * 排班交互说明：
 *  - 单击格子：按当前模式涂色（work/rest/erase）
 *  - 按住格子拖动：连续涂色（同样按当前模式）
 *  - 触摸设备：长按 + 拖拽
 */

let DATA = null;
let CURRENT_USER = null;        // 当前登录管理员
let CURRENT_WEEK = null;       // YYYY-MM-DD（当前日期所在周周一）
let CURRENT_DATE = null;       // YYYY-MM-DD（当前选中的排班日期）
let CURRENT_MODE = 'work';     // 'work' | 'rest' | 'erase'
let IS_PAINTING = false;       // 是否在拖拽涂色中
let DIRTY = false;             // 本周是否有过未保存改动

const WEEKDAY_NAME = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

// 初始化（带登录守卫）
function init() {
  CURRENT_USER = requireLogin('admin');
  if (!CURRENT_USER) return; // 已跳转

  DATA = loadData();

  // 默认选中今天，周范围随之联动
  const today = new Date();
  CURRENT_DATE = formatDate(today);
  CURRENT_WEEK = formatDate(getMondayOfThisWeek(today));

  // 顶部显示当前管理员
  document.getElementById('userAvatar').textContent = CURRENT_USER.name.charAt(0);
  document.getElementById('userName').textContent = CURRENT_USER.name;

  bindModeSegment();
  render();
}

function bindModeSegment() {
  const seg = document.getElementById('modeSeg');
  seg.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      seg.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      CURRENT_MODE = btn.dataset.mode;
    });
  });
}

function render() {
  renderWeekNav();
  renderScheduleTable();
  renderHoursList();
  renderMonthHoursList();
}

function renderWeekNav() {
  const monday = parseDate(CURRENT_WEEK);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const m1 = `${monday.getMonth() + 1}月${monday.getDate()}日`;
  const m2 = `${sunday.getMonth() + 1}月${sunday.getDate()}日`;
  const today = formatDate(new Date());
  const todayMonday = formatDate(getMondayOfThisWeek());
  document.getElementById('weekRange').textContent = `${monday.getFullYear()} · ${m1} - ${m2}`;
  document.getElementById('weekMeta').textContent = todayMonday === CURRENT_WEEK ? '本周' : '';

  // 日期切换条：当前选中日 + 星期
  const d = parseDate(CURRENT_DATE);
  const wd = d.getDay() === 0 ? 6 : d.getDay() - 1;
  const dayLabel = document.getElementById('dayLabel');
  if (dayLabel) {
    dayLabel.textContent = `${d.getMonth() + 1}/${d.getDate()} ${WEEKDAY_NAME[wd]}`;
  }
}

function renderScheduleTable() {
  const tbl = document.getElementById('scheduleTable');
  const d = parseDate(CURRENT_DATE);
  const slotLabels = getSlotLabels(DATA.settings);
  const slotCount = slotLabels.length;

  // 表头：日期分组（单日视图）
  let html = '<thead>';
  html += '<tr>';
  html += '<th class="sticky-col sticky-name"></th>';
  html += '<th class="sticky-col sticky-hours"></th>';
  const wd = d.getDay() === 0 ? 6 : d.getDay() - 1;
  html += `<th class="day-group" colspan="${slotCount}">${d.getMonth() + 1}/${d.getDate()} ${WEEKDAY_NAME[wd]}</th>`;
  html += '</tr>';

  // 时段子表头
  html += '<tr>';
  html += '<th class="sticky-col sticky-name"></th>';
  html += '<th class="sticky-col sticky-hours"></th>';
  slotLabels.forEach((lbl) => {
    html += `<th>${lbl.slice(0, 5)}</th>`;
  });
  html += '</tr>';
  html += '</thead>';

  // 表体：每位员工一行
  html += '<tbody>';
  DATA.employees.forEach((emp) => {
    html += renderEditableRow(emp.id, d);
  });
  html += '</tbody>';

  tbl.innerHTML = html;
}

function renderEditableRow(empId, date) {
  const emp = findEmployee(DATA, empId);
  const dateStr = formatDate(date);
  const interval = getBusinessSettings(DATA).slotInterval;
  const daySlots = getSchedule(DATA, empId, dateStr);
  const dayH = calcWorkHours(daySlots, interval).toFixed(1);
  let html = '<tr>';
  html += `<td class="name-cell">${emp.name}</td>`;
  html += `<td class="hours-cell" data-day-hours="${empId}">${dayH}h</td>`;
  const slots = getSchedule(DATA, empId, dateStr);
  slots.forEach((v, slotIdx) => {
    let cls = 'slot';
    if (v === 1) cls += ' work';
    else if (v === 2) cls += ' rest';
    html += `<td class="${cls}" data-emp="${empId}" data-date="${dateStr}" data-slot="${slotIdx}"></td>`;
  });
  html += '</tr>';
  return html;
}

function renderHoursList() {
  const list = document.getElementById('hoursList');
  const monday = parseDate(CURRENT_WEEK);
  const dates = getWeekDates(monday);
  let html = '';
  const interval = getBusinessSettings(DATA).slotInterval;
  DATA.employees.forEach((emp) => {
    let total = 0;
    let workDays = 0;
    dates.forEach((d) => {
      const s = getSchedule(DATA, emp.id, formatDate(d));
      const h = calcWorkHours(s, interval);
      total += h;
      if (h > 0) workDays++;
    });
    html += `
      <div class="row" onclick="showEmployeeDetail('${emp.id}', 'week')">
        <span class="nm">${emp.name}</span>
        <div class="bar"><div style="width:${Math.min(100, (total / 50) * 100)}%"></div></div>
        <span class="meta">${total.toFixed(1)}h · ${workDays}天</span>
      </div>
    `;
  });
  list.innerHTML = html;
}

function renderMonthHoursList() {
  const list = document.getElementById('monthHoursList');
  if (!list) return;
  const ref = parseDate(CURRENT_DATE);
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const dates = [];
  for (let d = 1; d <= lastDay; d++) {
    dates.push(new Date(year, month, d));
  }

  let html = '';
  const interval = getBusinessSettings(DATA).slotInterval;
  DATA.employees.forEach((emp) => {
    let total = 0;
    let workDays = 0;
    dates.forEach((d) => {
      const s = getSchedule(DATA, emp.id, formatDate(d));
      const h = calcWorkHours(s, interval);
      total += h;
      if (h > 0) workDays++;
    });
    html += `
      <div class="row" onclick="showEmployeeDetail('${emp.id}', 'month')">
        <span class="nm">${emp.name}</span>
        <div class="bar"><div style="width:${Math.min(100, (total / 200) * 100)}%"></div></div>
        <span class="meta">${total.toFixed(1)}h · ${workDays}天</span>
      </div>
    `;
  });
  list.innerHTML = html;
}

// ============== 员工考勤详情 ==============

function getRestRanges(slots, settings) {
  const { startMin, interval } = getSlotSettings(settings);
  const ranges = [];
  let startIdx = null;
  for (let i = 0; i <= slots.length; i++) {
    const isRest = i < slots.length && slots[i] === 2;
    if (isRest && startIdx === null) startIdx = i;
    if ((!isRest || i === slots.length) && startIdx !== null) {
      const sMin = startMin + startIdx * interval;
      const eMin = startMin + i * interval;
      ranges.push({ start: formatMinutesToTime(sMin), end: formatMinutesToTime(eMin) });
      startIdx = null;
    }
  }
  return ranges;
}

function getAttendanceRange(slots, settings) {
  const { startMin, interval } = getSlotSettings(settings);
  let firstIdx = -1;
  let lastIdx = -1;
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] === 1) {
      if (firstIdx === -1) firstIdx = i;
      lastIdx = i;
    }
  }
  if (firstIdx === -1) return null;
  return {
    start: formatMinutesToTime(startMin + firstIdx * interval),
    end: formatMinutesToTime(startMin + (lastIdx + 1) * interval),
  };
}

function showEmployeeDetail(empId, period) {
  const emp = findEmployee(DATA, empId);
  const settings = getBusinessSettings(DATA);
  let dates = [];
  let titleRange = '';

  if (period === 'week') {
    const monday = parseDate(CURRENT_WEEK);
    dates = getWeekDates(monday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    titleRange = `${formatDate(monday)} ~ ${formatDate(sunday)}`;
  } else {
    const ref = parseDate(CURRENT_DATE);
    const year = ref.getFullYear();
    const month = ref.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      dates.push(new Date(year, month, d));
    }
    titleRange = `${year}年${month + 1}月`;
  }

  let html = '<div class="detail-list">';
  dates.forEach((d) => {
    const dateStr = formatDate(d);
    const slots = getSchedule(DATA, empId, dateStr);
    const attendance = getAttendanceRange(slots, settings);
    const restRanges = getRestRanges(slots, settings);
    const wd = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const dayLabel = `${d.getMonth() + 1}/${d.getDate()} ${WEEKDAY_NAME[wd]}`;

    let timeHtml = '';
    if (attendance) {
      timeHtml += `<div class="work-time">考勤：${attendance.start} - ${attendance.end}</div>`;
    }
    if (restRanges.length) {
      const restText = restRanges.map((r) => `${r.start} - ${r.end}`).join('、');
      timeHtml += `<div class="rest-time">休息：${restText}</div>`;
    }
    if (!timeHtml) timeHtml = '<div class="empty-time">休息</div>';

    html += `<div class="detail-row"><span class="day">${dayLabel}</span><span class="time">${timeHtml}</span></div>`;
  });
  html += '</div>';

  document.getElementById('detailTitle').textContent = `${emp.name} · ${period === 'week' ? '本周' : '本月'}考勤详情 (${titleRange})`;
  document.getElementById('detailBody').innerHTML = html;
  document.getElementById('detailModal').classList.add('show');
}

function closeDetailModal() {
  document.getElementById('detailModal').classList.remove('show');
}

// ============== 交互：涂色 ==============

function paintCell(td) {
  const empId = td.dataset.emp;
  const dateStr = td.dataset.date;
  const slotIdx = parseInt(td.dataset.slot, 10);
  if (!empId) return;

  // 读取当前值
  const slots = getSchedule(DATA, empId, dateStr);
  let newVal = 0;
  if (CURRENT_MODE === 'work') newVal = 1;
  else if (CURRENT_MODE === 'rest') newVal = 2;
  else newVal = 0;

  if (slots[slotIdx] === newVal) return; // 没变化，跳过
  slots[slotIdx] = newVal;
  setSchedule(DATA, empId, dateStr, slots);

  // 更新 DOM
  td.classList.remove('work', 'rest');
  if (newVal === 1) td.classList.add('work');
  else if (newVal === 2) td.classList.add('rest');

  // 同步刷新左侧「当日工时」（当前选中日）
  updateDayHoursCell(empId);

  DIRTY = true;
}

function updateDayHoursCell(empId) {
  const slots = getSchedule(DATA, empId, CURRENT_DATE);
  const interval = getBusinessSettings(DATA).slotInterval;
  const h = calcWorkHours(slots, interval).toFixed(1);
  const cell = document.querySelector(`td.hours-cell[data-day-hours="${empId}"]`);
  if (cell) cell.textContent = h + 'h';
}

function bindPaintEvents() {
  const tbl = document.getElementById('scheduleTable');

  // 鼠标按下：开始涂色
  tbl.addEventListener('mousedown', (e) => {
    const td = e.target.closest('td.slot');
    if (!td) return;
    IS_PAINTING = true;
    paintCell(td);
    e.preventDefault();
  });

  // 鼠标拖动：连续涂色
  document.addEventListener('mousemove', (e) => {
    if (!IS_PAINTING) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const td = el && el.closest && el.closest('td.slot');
    if (td) paintCell(td);
  });

  document.addEventListener('mouseup', () => {
    if (IS_PAINTING) {
      IS_PAINTING = false;
      // 每次拖动结束刷新工时统计
      renderHoursList();
      renderMonthHoursList();
    }
  });

  // 触摸支持
  tbl.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const td = el && el.closest && el.closest('td.slot');
    if (!td) return;
    IS_PAINTING = true;
    paintCell(td);
  }, { passive: true });

  tbl.addEventListener('touchmove', (e) => {
    if (!IS_PAINTING) return;
    const t = e.touches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const td = el && el.closest && el.closest('td.slot');
    if (td) {
      paintCell(td);
      e.preventDefault();
    }
  }, { passive: false });

  tbl.addEventListener('touchend', () => {
    if (IS_PAINTING) {
      IS_PAINTING = false;
      renderHoursList();
      renderMonthHoursList();
    }
  });
}

// ============== 操作 ==============

function clearDay() {
  const d = parseDate(CURRENT_DATE);
  const dateLabel = `${d.getMonth() + 1}月${d.getDate()}日`;
  showModal(
    '清除当天排班',
    `此操作将清除 ${dateLabel} 所有员工的排班数据，确定继续吗？`,
    () => {
      const count = getSlotCount(DATA.settings);
      DATA.employees.forEach((emp) => {
        setSchedule(DATA, emp.id, CURRENT_DATE, new Array(count).fill(0));
      });
      render();
      showToast(`已清除 ${dateLabel} 排班`);
    }
  );
}

function saveAndPublish() {
  DATA.currentWeek = CURRENT_WEEK;
  saveData(DATA);
  DIRTY = false;
  showToast('✓ 当天排班已保存');
}

function shiftW(delta) {
  if (DIRTY) {
    showModal(
      '切换周次',
      '当前周有未保存的改动，是否先保存？',
      () => {
        saveAndPublish();
        applyWeekShift(delta);
      },
      () => {
        applyWeekShift(delta);
      }
    );
    return;
  }
  applyWeekShift(delta);
}

function applyWeekShift(delta) {
  CURRENT_WEEK = shiftWeek(CURRENT_WEEK, delta);
  // 切换周后，默认选中该周周一
  CURRENT_DATE = CURRENT_WEEK;
  render();
}

function shiftD(delta) {
  if (DIRTY) {
    showModal(
      '切换日期',
      '当前日期有未保存的改动，是否先保存？',
      () => {
        saveAndPublish();
        applyDayShift(delta);
      },
      () => {
        applyDayShift(delta);
      }
    );
    return;
  }
  applyDayShift(delta);
}

function applyDayShift(delta) {
  const d = parseDate(CURRENT_DATE);
  d.setDate(d.getDate() + delta);
  CURRENT_DATE = formatDate(d);
  CURRENT_WEEK = formatDate(getMondayOfThisWeek(d));
  render();
}

// ============== 模态对话框 ==============

let modalConfirmCb = null;
let modalCancelCb = null;

function showModal(title, body, onConfirm, onCancel) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').textContent = body;
  modalConfirmCb = onConfirm;
  modalCancelCb = onCancel;
  document.getElementById('modal').classList.add('show');
}

function closeModal() {
  document.getElementById('modal').classList.remove('show');
  if (modalCancelCb) modalCancelCb();
}

document.getElementById('modalConfirm').onclick = () => {
  document.getElementById('modal').classList.remove('show');
  if (modalConfirmCb) modalConfirmCb();
};

// ============== Toast ==============

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

// ============== 其他 ==============

function goSettings() {
  if (DIRTY && !confirm('当前有未保存改动，确定离开？')) return;
  window.location.href = 'settings.html';
}

function goManagement() {
  if (DIRTY && !confirm('当前有未保存改动，确定离开？')) return;
  window.location.href = 'management.html';
}

function doLogout() {
  logout();
  window.location.href = 'login.html';
}

// 启动
init();
bindPaintEvents();