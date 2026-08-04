/**
 * 茶百道工作台 · 员工端公共数据层
 * --------------------------------------------------------------------------
 * 为「配方查询 / 周清 / 备料」等员工端工具页提供：
 *  - 命名空间 KV 存储（localStorage，与排班/物料数据隔离）
 *  - 公共辅助函数（转义、toast 提示）
 *  - 默认种子数据（配方、周清任务）
 *
 * 注意：这些页面数据属于门店本机/个人工作状态，默认存本地 localStorage；
 * 与主排班（app_state）、物料（materials_state）共用 ChabaidaoDB 的就绪流程，
 * 但使用独立的 KV 命名空间，互不干扰。
 */
(function () {
  'use strict';

  const KV_PREFIX = 'chabadao_kv_';

  /* ---------- 命名空间 KV（localStorage） ---------- */
  const KV = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(KV_PREFIX + key);
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(KV_PREFIX + key, JSON.stringify(value));
      } catch (e) {
        /* 配额或隐私模式，静默失败 */
      }
    },
    remove(key) {
      try { localStorage.removeItem(KV_PREFIX + key); } catch (e) {}
    },
  };

  /* ---------- HTML 转义，防 XSS ---------- */
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  /* ---------- toast 提示 ---------- */
  let toastTimer = null;
  function showToast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    // 强制重排以便动画重新触发
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
  }

  /* ---------- 当前 ISO 周 key（年-周），用于周清按周重置 ---------- */
  function isoWeekKey(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = (d.getDay() + 6) % 7; // 周一为 0
    d.setDate(d.getDate() - day + 3); // 移到本周周四
    const firstThursday = new Date(d.getFullYear(), 0, 4);
    const week =
      1 +
      Math.round(
        ((d - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7
      );
    return d.getFullYear() + '-W' + (week < 10 ? '0' + week : week);
  }

  /* ---------- 默认配方数据（茶百道风格） ---------- */
  function defaultRecipes() {
    return [
      {
        id: 'r1',
        name: '珍珠奶茶',
        cat: '经典奶茶',
        ingredients: [
          { name: '珍珠', qty: '50 g / 杯' },
          { name: '红茶', qty: '200 ml' },
          { name: '牛奶', qty: '150 ml' },
          { name: '果糖', qty: '25 ml' },
        ],
        steps: '煮珍珠（沸水 30 分钟焖 20 分钟）→ 泡红茶 5 分钟 → 杯中加入珍珠、茶汤、牛奶与果糖 → 摇匀出杯。',
      },
      {
        id: 'r2',
        name: '杨枝甘露',
        cat: '鲜果茶',
        ingredients: [
          { name: '芒果', qty: '1 个 / 杯' },
          { name: '西柚', qty: '30 g' },
          { name: '西米', qty: '40 g' },
          { name: '椰浆', qty: '80 ml' },
          { name: '牛奶', qty: '100 ml' },
        ],
        steps: '煮西米至透明过冷水 → 芒果取肉打泥 → 混合椰浆与牛奶 → 杯中加入西米、芒果泥、西柚粒 → 补冰。',
      },
      {
        id: 'r3',
        name: '葡萄冻冻',
        cat: '鲜果茶',
        ingredients: [
          { name: '葡萄', qty: '120 g' },
          { name: '寒天冻', qty: '1 份' },
          { name: '绿茶', qty: '200 ml' },
          { name: '果糖', qty: '20 ml' },
        ],
        steps: '葡萄捣压出汁 → 杯底铺寒天冻 → 注入绿茶与果糖 → 上加葡萄果肉与冰块。',
      },
      {
        id: 'r4',
        name: '茉莉奶绿',
        cat: '经典奶茶',
        ingredients: [
          { name: '茉莉绿茶', qty: '200 ml' },
          { name: '牛奶', qty: '150 ml' },
          { name: '果糖', qty: '20 ml' },
        ],
        steps: '泡茉莉绿茶 4 分钟 → 加牛奶与果糖 → 摇匀加冰出杯。',
      },
      {
        id: 'r5',
        name: '柠檬茶',
        cat: '鲜果茶',
        ingredients: [
          { name: '柠檬', qty: '30 g' },
          { name: '红茶', qty: '200 ml' },
          { name: '果糖', qty: '30 ml' },
        ],
        steps: '柠檬切片捣压出汁 → 注入红茶 → 加果糖与冰块 → 摇匀。',
      },
      {
        id: 'r6',
        name: '芋圆波波牛奶',
        cat: '经典奶茶',
        ingredients: [
          { name: '芋圆', qty: '50 g / 杯' },
          { name: '牛奶', qty: '250 ml' },
          { name: '果糖', qty: '20 ml' },
        ],
        steps: '芋圆煮 3 分钟过冷水 → 杯中加入芋圆 → 倒牛奶与果糖 → 搅拌出杯。',
      },
    ];
  }

  /* ---------- 默认物料（备料页在无物料数据时的兜底种子） ---------- */
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

  /* ---------- 默认周清任务 ---------- */
  function defaultCleanTasks() {
    return [
      { id: 'c1', area: '设备', name: '制冰机内部清洗消毒', note: '断电清空后，用专用消毒液擦拭内胆与出冰口。' },
      { id: 'c2', area: '设备', name: '封口机刀口与拖盘清洁', note: '清除残料，防止卡膜与异味。' },
      { id: 'c3', area: '设备', name: '果糖机除垢', note: '用温水循环清洗管路，检查出糖量。' },
      { id: 'c4', area: '设备', name: '冰沙机 / 搅拌机消毒', note: '可拆卸部件拆下浸泡消毒，刀头勿碰手。' },
      { id: 'c5', area: '操作区', name: '操作台与台面深度清洁', note: '去除茶渍奶渍，抹布消毒后擦拭。' },
      { id: 'c6', area: '操作区', name: '奶茶桶 / 量杯 / 雪克杯消毒', note: '高温或消毒液浸泡后倒扣晾干。' },
      { id: 'c7', area: '后场', name: '冰箱除霜与整理', note: '过期原料丢弃，分类摆放，生熟分开。' },
      { id: 'c8', area: '后场', name: '排水沟与地漏清理', note: '除异味防堵塞，定期倒入管道清洁剂。' },
      { id: 'c9', area: '环境', name: '地面墙面清洗', note: '重点操作区与地面油污，墙面擦至无污点。' },
      { id: 'c10', area: '环境', name: '外场桌椅与招牌擦拭', note: '保持门店形象，玻璃门无手印。' },
    ];
  }

  window.ChabaidaoKV = KV;
  window.escapeHtml = escapeHtml;
  window.showToast = showToast;
  window.isoWeekKey = isoWeekKey;
  window.defaultRecipes = defaultRecipes;
  window.defaultCleanTasks = defaultCleanTasks;
  window.defaultMaterials = defaultMaterials;
})();
