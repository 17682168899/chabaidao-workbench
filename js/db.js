/**
 * 茶百道工作台 - 统一数据层（双模式）
 * --------------------------------------------------------------------------
 *  - 配置了 Supabase（js/supabase-config.js）→ 云端共享 + 实时订阅
 *  - 未配置 → 自动回退到本机 localStorage（保持原有行为）
 *
 * 对外暴露 window.ChabaidaoDB：
 *  - ready()                 页面初始化前 await，等首屏数据就绪
 *  - isRemote()              当前是否为云端模式
 *  - getApp() / setApp(data) 排班总数据（employees/currentWeek/schedules/settings）
 *  - getMaterials()/setMaterials(arr)  物料数组
 *  - onRemoteChange(cb)      云端有其他人改动时触发（用于实时重渲染）
 *  - reset()                 清空本地与云端数据
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'chabadao_workbench_v1';
  const MAT_KEY = 'chabadao_materials_v1';
  const APP_ROW = 'main';
  const MAT_ROW = 'main';

  let client = null;
  let mode = 'local';          // 'local' | 'remote'
  let booted = false;
  let readyPromise = null;
  let appCache = null;        // 排班总数据对象
  let matCache = null;        // 物料数组
  const listeners = [];

  function configured() {
    return (
      typeof window.SUPABASE_URL === 'string' &&
      window.SUPABASE_URL &&
      window.SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
      typeof window.SUPABASE_ANON_KEY === 'string' &&
      window.SUPABASE_ANON_KEY &&
      window.SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY' &&
      typeof window.supabase !== 'undefined' &&
      window.supabase.createClient
    );
  }

  /* ---------- 本地回退 ---------- */
  function localLoadApp() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function localLoadMaterials() {
    try {
      const raw = localStorage.getItem(MAT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /* ---------- 启动：拉取首屏数据 ---------- */
  async function boot() {
    if (booted) return;
    booted = true;

    if (configured()) {
      try {
        client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        const a = await client
          .from('app_state')
          .select('value')
          .eq('id', APP_ROW)
          .maybeSingle();
        if (a.error) throw a.error;
        appCache = a.data ? a.data.value : null;

        const m = await client
          .from('materials_state')
          .select('value')
          .eq('id', MAT_ROW)
          .maybeSingle();
        if (m.error) throw m.error;
        matCache = m.data ? m.data.value : null;

        mode = 'remote';
        setupRealtime();
      } catch (e) {
        console.error('[ChabaidaoDB] Supabase 初始化失败，回退本地存储：', e);
        mode = 'local';
      }
    }

    if (mode === 'local') {
      appCache = localLoadApp();
      matCache = localLoadMaterials();
    }
  }

  function ready() {
    if (!readyPromise) readyPromise = boot();
    return readyPromise;
  }

  /* ---------- 实时订阅 ---------- */
  function setupRealtime() {
    if (!client) return;
    client
      .channel('chabaidao-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state' }, () => refreshApp())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'materials_state' }, () => refreshMaterials())
      .subscribe();
  }

  async function refreshApp() {
    if (!client) return;
    try {
      const { data, error } = await client
        .from('app_state')
        .select('value')
        .eq('id', APP_ROW)
        .maybeSingle();
      if (!error && data) {
        appCache = data.value;
        notify();
      }
    } catch (e) {
      /* 忽略瞬时错误 */
    }
  }

  async function refreshMaterials() {
    if (!client) return;
    try {
      const { data, error } = await client
        .from('materials_state')
        .select('value')
        .eq('id', MAT_ROW)
        .maybeSingle();
      if (!error && data) {
        matCache = data.value;
        notify();
      }
    } catch (e) {
      /* 忽略瞬时错误 */
    }
  }

  function notify() {
    listeners.forEach((cb) => {
      try { cb(); } catch (e) { /* 单个回调出错不影响其他 */ }
    });
  }

  /* ---------- 读写接口（页面调用） ---------- */
  function getApp() {
    return appCache;
  }
  function setApp(data) {
    appCache = data;
    persistApp(data);
  }
  function getMaterials() {
    return matCache;
  }
  function setMaterials(arr) {
    matCache = arr;
    persistMaterials(arr);
  }

  function persistApp(data) {
    if (mode === 'remote' && client) {
      client
        .from('app_state')
        .upsert({ id: APP_ROW, value: data, updated_at: new Date().toISOString() })
        .then(() => {})
        .catch((e) => console.error('[ChabaidaoDB] 保存排班失败：', e));
    } else {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
    }
  }
  function persistMaterials(arr) {
    if (mode === 'remote' && client) {
      client
        .from('materials_state')
        .upsert({ id: MAT_ROW, value: arr, updated_at: new Date().toISOString() })
        .then(() => {})
        .catch((e) => console.error('[ChabaidaoDB] 保存物料失败：', e));
    } else {
      try { localStorage.setItem(MAT_KEY, JSON.stringify(arr)); } catch (e) {}
    }
  }

  function reset() {
    appCache = null;
    matCache = null;
    if (mode === 'remote' && client) {
      client.from('app_state').delete().eq('id', APP_ROW).then(() => {}).catch(() => {});
      client.from('materials_state').delete().eq('id', MAT_ROW).then(() => {}).catch(() => {});
    }
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    try { localStorage.removeItem(MAT_KEY); } catch (e) {}
    notify();
  }

  window.ChabaidaoDB = {
    ready,
    isRemote: () => mode === 'remote',
    getApp,
    setApp,
    getMaterials,
    setMaterials,
    onRemoteChange: (cb) => { listeners.push(cb); },
    reset,
  };
})();
