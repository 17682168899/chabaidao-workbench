/**
 * 茶百道工作台 - 员工端逻辑
 */

let DATA = null;
let CURRENT_USER = null;   // 当前登录用户对象
let CURRENT_EMP_ID = null; // = CURRENT_USER.id
let CURRENT_WEEK = null;   // YYYY-MM-DD (Monday)
let CURRENT_MONTH = null;  // { year, month } 当前查看的月份（month 0-based）
let STAT_PERIOD = 'week';  // 工时统计周期：week | month

const WEEKDAY_NAME = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

// 初始化（带登录守卫）
async function init() {
  await ChabaidaoDB.ready();
  // 必须是员工身份
  CURRENT_USER = requireLogin('staff');
  if (!CURRENT_USER) return; // 已跳转

  DATA = loadData();
  CURRENT_EMP_ID = CURRENT_USER.id;
  CURRENT_WEEK = DATA.currentWeek || formatDate(getMondayOfThisWeek());
  const now = new Date();
  CURRENT_MONTH = { year: now.getFullYear(), month: now.getMonth() };

  // 顶部显示当前用户
  document.getElementById('userAvatar').textContent = CURRENT_USER.name.charAt(0);
  document.getElementById('userName').textContent = CURRENT_USER.name;

  renderHero();
  setupTabbar();
  render();
}

function render() {
  renderTodayShift();
  renderMonthCalendar();
  renderHoursStats();
  renderTodayOthers();

  ChabaidaoDB.onRemoteChange(() => {
    if (!CURRENT_USER) return;
    DATA = loadData();
    render();
  });
}

// ============== 今日考勤班次 ==============
function renderTodayShift() {
  const box = document.getElementById('todayShiftBox');
  if (!box) return;
  const today = formatDate(new Date());
  const slots = getSchedule(DATA, CURRENT_EMP_ID, today);
  const info = dayWorkInfo(slots);
  const settings = getBusinessSettings(DATA);
  const hasRestOnly = !info.hasWork && slots.some((s) => s === 2);

  if (!info.hasWork && !hasRestOnly) {
    box.innerHTML = `<div class="ts-empty">😴 今日未排班</div>`;
    return;
  }

  let html = '';
  if (info.hasWork) {
    html += `<div class="ts-main">
      <div class="ts-range">${info.start} <span>—</span> ${info.end}</div>
      <div class="ts-hours">${info.hours}<small>h</small></div>
    </div>`;
  } else {
    html += `<div class="ts-main"><div class="ts-range">🌙 今日休息</div></div>`;
  }

  const restRanges = getRestRangesEmp(slots, settings);
  if (restRanges.length) {
    const restText = restRanges.map((r) => `${r.start} - ${r.end}`).join('、');
    html += `<div class="ts-rest">休息时段：${restText}</div>`;
  }
  box.innerHTML = html;
}

// 计算某日上班信息：开始/结束/工时（含休息段合并）
function dayWorkInfo(slots) {
  const settings = DATA.settings;
  const labels = getSlotLabels(settings);
  const { startMin, interval } = getSlotSettings(settings);
  let first = -1, last = -1, workCount = 0;
  slots.forEach((v, i) => {
    if (v === 1 || v === 2) { if (first < 0) first = i; last = i; }
    if (v === 1) workCount++;
  });
  if (workCount === 0) return { hasWork: false, hours: 0 };
  const startLbl = first === 0 ? getBusinessSettings(DATA).businessStart : labels[first - 1];
  const endLbl = labels[last];
  const hours = (workCount * (interval / 60)).toFixed(1);
  return { hasWork: true, hours, start: startLbl, end: endLbl };
}

function getRestRangesEmp(slots, settings) {
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

// ============== 本月考勤日历 ==============
function renderMonthCalendar() {
  const calEl = document.getElementById('calendar');
  if (!calEl) return;
  const year = CURRENT_MONTH.year;
  const month = CURRENT_MONTH.month; // 0-based
  const labelEl = document.getElementById('monthLabel');
  if (labelEl) labelEl.textContent = `${year}年${month + 1}月`;

  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();      // 日=0
  const lead = (startWeekday + 6) % 7;          // 周一为一周起始
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = formatDate(new Date());

  let html = WEEKDAY_NAME.map((w) => `<div class="cal-head">${w}</div>`).join('');
  for (let i = 0; i < lead; i++) html += '<div class="cal-day blank"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const key = formatDate(date);
    const slots = getSchedule(DATA, CURRENT_EMP_ID, key);
    const scheduled = slots.some((s) => s === 1 || s === 2);
    const isToday = key === todayStr;
    let cls = 'cal-day';
    if (isToday) cls += ' today';
    if (scheduled) cls += ' has-work';

    html += `<div class="${cls}" ${scheduled ? `onclick="openDayModal('${key}')"` : ''}>
      <div class="dnum">${d}</div>
      ${scheduled ? '<div class="dot-blue"></div>' : ''}
    </div>`;
  }
  calEl.innerHTML = html;
}

function shiftMonth(delta) {
  let m = CURRENT_MONTH.month + delta;
  let y = CURRENT_MONTH.year;
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0; y++; }
  CURRENT_MONTH = { year: y, month: m };
  renderMonthCalendar();
}

// ============== 工时统计（本周/本月） ==============
function renderHoursStats() {
  const grid = document.getElementById('hoursStatGrid');
  if (!grid) return;
  const interval = getBusinessSettings(DATA).slotInterval;
  let dates = [];
  if (STAT_PERIOD === 'week') {
    const monday = parseDate(CURRENT_WEEK);
    dates = getWeekDates(monday);
  } else {
    const y = CURRENT_MONTH.year;
    const m = CURRENT_MONTH.month;
    const last = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= last; d++) dates.push(new Date(y, m, d));
  }

  let total = 0, workDays = 0;
  dates.forEach((d) => {
    const s = getSchedule(DATA, CURRENT_EMP_ID, formatDate(d));
    const h = calcWorkHours(s, interval);
    total += h;
    if (h > 0) workDays++;
  });
  const avg = workDays > 0 ? total / workDays : 0;
  const tag = STAT_PERIOD === 'week' ? '本周' : '本月';

  grid.innerHTML = `
    <div class="stat-item">
      <span class="ico">⏰</span>
      <div class="num">${total.toFixed(1)}<small>h</small></div>
      <div class="label">${tag}工时</div>
    </div>
    <div class="stat-item">
      <span class="ico">📅</span>
      <div class="num">${workDays}<small>天</small></div>
      <div class="label">上班天数</div>
    </div>
    <div class="stat-item">
      <span class="ico">📈</span>
      <div class="num">${avg.toFixed(1)}<small>h</small></div>
      <div class="label">日均工时</div>
    </div>
  `;
}

function switchStatPeriod(p) {
  STAT_PERIOD = p;
  document.querySelectorAll('#statSeg .seg-btn').forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-period') === p);
  });
  renderHoursStats();
}

// ============== 日历日详情 ==============
function openDayModal(dateStr) {
  const slots = getSchedule(DATA, CURRENT_EMP_ID, dateStr);
  const info = dayWorkInfo(slots);
  const settings = getBusinessSettings(DATA);
  const date = parseDate(dateStr);
  const wd = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
  document.getElementById('dayModalTitle').textContent = `${dateStr} 周${wd} · 上班时间`;

  let html = '';
  if (info.hasWork) {
    html += `<div class="detail-row"><span class="day">考勤时段</span><span class="time"><span class="work-time">${info.start} - ${info.end}</span></span></div>`;
    html += `<div class="detail-row"><span class="day">当日工时</span><span class="time"><span class="work-time">${info.hours} h</span></span></div>`;
  } else if (slots.some((s) => s === 2)) {
    html += `<div class="detail-row"><span class="day">状态</span><span class="time"><span class="rest-time">休息</span></span></div>`;
  } else {
    html += `<div class="detail-row"><span class="day">状态</span><span class="time"><span class="empty-time">未排班</span></span></div>`;
  }

  const restRanges = getRestRangesEmp(slots, settings);
  if (restRanges.length) {
    const restText = restRanges.map((r) => `${r.start} - ${r.end}`).join('、');
    html += `<div class="detail-row"><span class="day">休息时段</span><span class="time"><span class="rest-time">${restText}</span></span></div>`;
  }

  document.getElementById('dayModalBody').innerHTML = `<div class="detail-list">${html}</div>`;
  document.getElementById('dayModal').classList.add('show');
}

function closeDayModal() {
  document.getElementById('dayModal').classList.remove('show');
}

function renderTodayOthers() {
  const today = formatDate(new Date());
  const list = document.getElementById('todayList');
  const interval = getBusinessSettings(DATA).slotInterval;
  const slotCount = getSlotCount(DATA.settings);
  const others = DATA.employees.filter((e) => e.id !== CURRENT_EMP_ID);
  if (others.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="icon">👥</div><p>暂无其他员工</p></div>';
    return;
  }

  let html = '';
  others.forEach((emp) => {
    const slots = getSchedule(DATA, emp.id, today);
    const workCells = slots.filter((s) => s === 1).length;
    const restCells = slots.filter((s) => s === 2).length;
    const workHours = (workCells * (interval / 60)).toFixed(1);
    const restHours = (restCells * (interval / 60)).toFixed(1);

    let status = '未排班';
    let barFill = '0%';
    let barCls = '';
    if (workCells > 0) {
      status = `${workHours}h`;
      barFill = `${Math.min(100, (workCells / slotCount) * 100)}%`;
    } else if (restCells > 0) {
      status = `休息 ${restHours}h`;
      barCls = 'rest';
      barFill = '100%';
    }
    html += `
      <div class="row">
        <span class="nm">${emp.name}</span>
        <div class="bar"><div class="${barCls}" style="width:${barFill}"></div></div>
        <span class="meta">${status}</span>
      </div>
    `;
  });
  list.innerHTML = html;
}

function doLogout() {
  logout();
  window.location.href = 'login.html';
}

// 顶部问候横幅 + 今日班次
function renderHero() {
  const now = new Date();
  const h = now.getHours();
  let greet = '你好';
  if (h < 6) greet = '凌晨好';
  else if (h < 12) greet = '早上好';
  else if (h < 14) greet = '中午好';
  else if (h < 18) greet = '下午好';
  else if (h < 22) greet = '晚上好';
  else greet = '夜深了';

  const wd = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
  const greetEl = document.getElementById('empGreet');
  const dateEl = document.getElementById('empDate');
  const shiftEl = document.getElementById('empShift');
  const heroH = document.getElementById('heroTodayHours');
  if (greetEl) greetEl.textContent = `${greet}，${CURRENT_USER.name}`;
  if (dateEl) dateEl.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 周${wd}`;

  const today = formatDate(now);
  const slots = getSchedule(DATA, CURRENT_EMP_ID, today);
  const range = localAttendanceRange(slots);
  if (range) {
    if (shiftEl) {
      shiftEl.innerHTML = `🕒 今日班次 ${range.start} - ${range.end}`;
      shiftEl.style.display = 'inline-flex';
    }
    if (heroH) heroH.innerHTML = `${range.hours}<small>h</small>`;
  } else {
    if (shiftEl) {
      shiftEl.innerHTML = '😴 今日休息';
      shiftEl.style.display = 'inline-flex';
    }
    if (heroH) heroH.innerHTML = `0<small>h</small>`;
  }
}

// 计算某员工某日的考勤起止（含休息段合并）
function localAttendanceRange(slots) {
  const settings = DATA.settings;
  const labels = getSlotLabels(settings);
  const interval = getBusinessSettings(DATA).slotInterval;
  let first = -1, last = -1, workCount = 0;
  slots.forEach((v, i) => {
    if (v === 1 || v === 2) { if (first < 0) first = i; last = i; }
    if (v === 1) workCount++;
  });
  if (first < 0) return null;
  const startLbl = first === 0 ? getBusinessSettings(DATA).businessStart : labels[first - 1];
  const endLbl = labels[last];
  const hours = (workCount * (interval / 60)).toFixed(1);
  return { start: startLbl, end: endLbl, hours };
}

// 底部导航：点击平滑滚动到对应区块
function setupTabbar() {
  const tabs = document.querySelectorAll('.emp-tabbar .emp-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-target');
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      if (target === 'top') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const el = document.getElementById(target);
        if (el) {
          const y = el.getBoundingClientRect().top + window.pageYOffset - 60;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }
    });
  });
}

// 启动
init();