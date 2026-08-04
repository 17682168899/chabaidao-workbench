/**
 * 茶百道工作台 - 员工端逻辑
 */

let DATA = null;
let CURRENT_USER = null;   // 当前登录用户对象
let CURRENT_EMP_ID = null; // = CURRENT_USER.id
let CURRENT_WEEK = null;   // YYYY-MM-DD (Monday)

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

  // 顶部显示当前用户
  document.getElementById('userAvatar').textContent = CURRENT_USER.name.charAt(0);
  document.getElementById('userName').textContent = CURRENT_USER.name;

  render();
}

function render() {
  renderWeekNav();
  renderStats();
  renderCalendar();
  renderMySchedule();
  renderTodayOthers();

  ChabaidaoDB.onRemoteChange(() => {
    if (!CURRENT_USER) return;
    DATA = loadData();
    render();
  });
}

function renderWeekNav() {
  const monday = parseDate(CURRENT_WEEK);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const m1 = `${monday.getMonth() + 1}月${monday.getDate()}日`;
  const m2 = `${sunday.getMonth() + 1}月${sunday.getDate()}日`;
  const today = formatDate(new Date());
  const mondayStr = formatDate(monday);
  document.getElementById('weekRange').textContent = `${monday.getFullYear()} · ${m1} - ${m2}`;
  document.getElementById('weekMeta').textContent = mondayStr === today ? '本周' : '';
}

function renderStats() {
  const monday = parseDate(CURRENT_WEEK);
  const today = formatDate(new Date());
  const interval = getBusinessSettings(DATA).slotInterval;
  const weekH = calcWeekHours(DATA, CURRENT_EMP_ID, monday);
  const todaySlots = getSchedule(DATA, CURRENT_EMP_ID, today);
  const todayH = calcWorkHours(todaySlots, interval);

  const dates = getWeekDates(monday);
  let workDays = 0;
  dates.forEach((d) => {
    const s = getSchedule(DATA, CURRENT_EMP_ID, formatDate(d));
    if (calcWorkHours(s, interval) > 0) workDays++;
  });

  document.getElementById('statWeekHours').innerHTML = `${weekH}<small>h</small>`;
  document.getElementById('statTodayHours').innerHTML = `${todayH}<small>h</small>`;
  document.getElementById('statDays').innerHTML = `${workDays}<small>天</small>`;
}

function renderCalendar() {
  const calEl = document.getElementById('calendar');
  const today = new Date();
  const todayStr = formatDate(today);
  const monday = parseDate(CURRENT_WEEK);

  let html = WEEKDAY_NAME.map((w) => `<div class="cal-head">${w}</div>`).join('');

  const dates = getWeekDates(monday);
  const interval = getBusinessSettings(DATA).slotInterval;
  dates.forEach((d) => {
    const key = formatDate(d);
    const slots = getSchedule(DATA, CURRENT_EMP_ID, key);
    const work = slots.filter((s) => s === 1).length;
    const rest = slots.filter((s) => s === 2).length;
    const hours = (work * (interval / 60)).toFixed(1);
    const isToday = key === todayStr;
    let cls = 'cal-day';
    if (isToday) cls += ' today';
    else if (work > 0) cls += ' has-work';
    else if (rest > 0) cls += ' is-rest';

    html += `
      <div class="${cls}">
        <div class="dnum">${d.getDate()}</div>
        <div class="dtag">${work > 0 ? hours + 'h' : rest > 0 ? '休' : '—'}</div>
      </div>
    `;
  });

  calEl.innerHTML = html;
}

function renderMySchedule() {
  const tbl = document.getElementById('mySchedule');
  const monday = parseDate(CURRENT_WEEK);
  const dates = getWeekDates(monday);
  const emp = findEmployee(DATA, CURRENT_EMP_ID);
  const slotLabels = getSlotLabels(DATA.settings);
  const slotCount = slotLabels.length;

  let html = '<thead>';
  html += '<tr>';
  html += '<th class="sticky-col sticky-name" rowspan="2">姓名</th>';
  html += '<th class="sticky-col sticky-position" rowspan="2">岗位</th>';
  html += '<th class="sticky-col sticky-hours" rowspan="2">本周工时</th>';
  dates.forEach((d) => {
    const wd = d.getDay() === 0 ? 6 : d.getDay() - 1;
    html += `<th class="date-col" colspan="${slotCount}">${d.getMonth() + 1}/${d.getDate()} ${WEEKDAY_NAME[wd]}</th>`;
  });
  html += '</tr>';
  html += '<tr>';
  dates.forEach(() => {
    slotLabels.forEach((lbl) => {
      html += `<th>${lbl.slice(0, 5)}</th>`;
    });
  });
  html += '</tr>';
  html += '</thead>';

  html += '<tbody>';
  html += '<tr>';
  html += `<td class="name-cell">${emp ? emp.name : '我'}</td>`;
  html += `<td class="position-cell">${emp && emp.position ? emp.position : '-'}</td>`;
  html += `<td class="hours-cell">${calcWeekHours(DATA, CURRENT_EMP_ID, monday).toFixed(1)}h</td>`;
  dates.forEach((d) => {
    const key = formatDate(d);
    const slots = getSchedule(DATA, CURRENT_EMP_ID, key);
    slots.forEach((v) => {
      let cls = 'slot';
      if (v === 1) cls += ' work';
      else if (v === 2) cls += ' rest';
      html += `<td class="${cls}"></td>`;
    });
  });
  html += '</tr>';
  html += '</tbody>';

  tbl.innerHTML = html;
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

function shiftW(delta) {
  CURRENT_WEEK = shiftWeek(CURRENT_WEEK, delta);
  render();
}

function doLogout() {
  logout();
  window.location.href = 'login.html';
}

// 启动
init();