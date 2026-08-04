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

  /* ---------- 默认配方数据（依据《SOP-20260625-茶饮咖啡》与《SOP-260625-全本》整理） ---------- */
  function defaultRecipes() {
    return [
      /* ===== 咖啡（19 款） ===== */
      {
        id: 'r1', name: '美式', cat: '咖啡',
        ingredients: [
          { name: '黄金糖', qty: '20cc' },
          { name: '净水', qty: '50ml(热)/200ml(冰)' },
          { name: '热水', qty: '300ml(热)' },
          { name: '咖啡', qty: '美式-标准 1 份' },
        ],
        steps: '热：咖啡纸杯2.0 加黄金糖→按「美式-标准」出咖啡→加净水→加热水→加热饮盖。冰：98-520PET 杯加净水→黄金糖搅匀→冰块→按「美式-标准」出咖啡→加直饮卡口盖。配细吸管。',
      },
      {
        id: 'r2', name: '鲜牛乳拿铁', cat: '咖啡',
        ingredients: [
          { name: '鲜牛奶', qty: '300ml(热)/200ml(冰)' },
          { name: '黄金糖', qty: '10cc' },
          { name: '咖啡', qty: '鲜牛乳拿铁-标准 1 份' },
        ],
        steps: '热：咖啡纸杯加咖啡→拉花杯加鲜牛奶+黄金糖→按蒸汽键打奶泡→倒入→加热饮盖。冰：98-520PET 杯加鲜牛奶+黄金糖搅匀→冰块→按「鲜牛乳拿铁-标准」出咖啡→加直饮卡口盖。配细吸管。',
      },
      {
        id: 'r3', name: '拿铁', cat: '咖啡',
        ingredients: [
          { name: '高原醇牛奶', qty: '300ml(热)/200ml(冰)' },
          { name: '黄金糖', qty: '10cc' },
          { name: '咖啡', qty: '鲜牛乳拿铁-标准 1 份' },
        ],
        steps: '同鲜牛乳拿铁，使用高原醇牛奶。热饮出咖啡后再打奶泡倒入；冰饮牛奶+糖搅匀加冰出咖啡。配细吸管。',
      },
      {
        id: 'r4', name: '香草拿铁', cat: '咖啡',
        ingredients: [
          { name: '鲜牛奶/高原醇牛奶', qty: '280ml(热)/200ml(冰)' },
          { name: 'C3 云绒轻乳', qty: '10cc' },
          { name: '冷冻香草风味糖浆', qty: '12g' },
          { name: '黄金糖', qty: '10cc' },
          { name: '咖啡', qty: '风味拿铁 1 份' },
        ],
        steps: '杯中加黄金糖→(冰：加香草糖浆+牛奶+C3轻乳搅匀)→冰块→按「风味拿铁」出咖啡→加直饮卡口盖。若不满杯补冰块。配细吸管。',
      },
      {
        id: 'r5', name: '香草冰淇淋拿铁', cat: '咖啡',
        ingredients: [
          { name: '冷冻香草风味糖浆', qty: '5g' },
          { name: '黄金糖', qty: '10cc' },
          { name: '鲜牛奶/高原醇牛奶', qty: '150ml(正常冰)/180ml(少冰)' },
          { name: '香草冰淇淋', qty: '1 颗' },
          { name: '可可粉', qty: '适量装饰' },
          { name: '咖啡', qty: '风味拿铁 1 份' },
        ],
        steps: '98-520PET 杯加香草糖浆+黄金糖+牛奶搅匀→冰块→香草冰淇淋→按「风味拿铁」出咖啡→撒可可粉装饰→加直饮卡口盖。配粗吸管。',
      },
      {
        id: 'r6', name: '生椰拿铁', cat: '咖啡',
        ingredients: [
          { name: '冷冻椰子乳', qty: '250ml(热)/220ml(冰)' },
          { name: '鲜牛奶/高原醇牛奶', qty: '50ml(热)' },
          { name: '黄金糖', qty: '5cc' },
          { name: '咖啡', qty: '风味拿铁 1 份' },
        ],
        steps: '热：咖啡纸杯加咖啡→拉花杯加椰子乳+牛奶+黄金糖→蒸汽打奶泡→倒入→加热饮盖。冰：98-520PET 杯加椰子乳+黄金糖搅匀→冰块→出咖啡→加直饮卡口盖。若不满杯补冰。配细吸管。',
      },
      {
        id: 'r7', name: '咸法酪拿铁', cat: '咖啡',
        ingredients: [
          { name: '鲜牛奶/高原醇牛奶', qty: '250ml(热)/180ml(冰)' },
          { name: '云朵轻乳酪', qty: '50cc(热)/40cc(冰)' },
          { name: '黄金糖', qty: '5cc' },
          { name: '咖啡', qty: '风味拿铁 1 份' },
        ],
        steps: '杯中加牛奶+云朵轻乳酪(盎司杯取量、用前摇匀)+黄金糖→(冰：搅匀)→冰块→按「风味拿铁」出咖啡→加直饮卡口盖。配细吸管。',
      },
      {
        id: 'r8', name: '粉雾芭乐拿铁', cat: '咖啡',
        ingredients: [
          { name: '冷冻芭乐浆', qty: '70ml(正常冰)/120ml(少冰)' },
          { name: 'C3 云绒轻乳', qty: '40cc' },
          { name: '鲜牛奶/高原醇牛奶', qty: '20ml' },
          { name: '净水', qty: '80ml' },
          { name: '黄金糖', qty: '10cc' },
          { name: '咖啡', qty: '风味拿铁 1 份' },
        ],
        steps: '98-520PET 杯加芭乐浆+C3轻乳+牛奶+净水+黄金糖搅匀→冰块→按「风味拿铁」出咖啡(建议盎司杯接取缓倒分层)→加直饮卡口盖。出品提醒边搅边喝。配细吸管。',
      },
      {
        id: 'r9', name: '1升柠没事气泡美式', cat: '咖啡',
        ingredients: [
          { name: '柠檬片', qty: '4 片' },
          { name: '冰块', qty: '8-10 块' },
          { name: '七窨茉香雪芽', qty: '60ml' },
          { name: '黄金糖', qty: '35cc' },
          { name: '泰象苏打水', qty: '1 瓶' },
          { name: '咖啡', qty: '1升果咖 1 份' },
        ],
        steps: '雪克壶加柠檬片+冰块，捣棒重捶15次出香→加七窨茉香雪芽+黄金糖+冰块摇匀→倒入超大杯→加泰象苏打水搅匀→浓缩咖啡→加盖。可做全糖/7分/5分糖。配细吸管。',
      },
      {
        id: 'r10', name: '1升爱吃瓜气泡美式', cat: '咖啡',
        ingredients: [
          { name: '西瓜', qty: '200g' },
          { name: '黄金糖', qty: '35cc' },
          { name: '净水', qty: '50ml' },
          { name: '泰象苏打水', qty: '1 瓶' },
          { name: '咖啡', qty: '1升果咖 1 份' },
        ],
        steps: '沙冰杯称西瓜+净水+黄金糖→沙冰机A键打至完全碎→倒入超大杯→冰块→堂食：加苏打水→去沫→咖啡→加盖；外卖：咖啡→加盖→苏打水。配细吸管。',
      },
      {
        id: 'r11', name: '鲜牛奶', cat: '咖啡',
        ingredients: [
          { name: '鲜牛奶', qty: '320ml(热)/280ml(冰)' },
          { name: '黄金糖', qty: '15cc(热)/10分·230g(冰)' },
        ],
        steps: '热：拉花杯加鲜牛奶+黄金糖→蒸汽加热→倒入咖啡纸杯2.0→加热饮盖。冰：98-520PET 杯加鲜牛奶+黄金糖搅匀→冰块→加直饮卡口盖。配细吸管。',
      },
      {
        id: 'r12', name: '紫苏多肉桃桃美式', cat: '咖啡',
        ingredients: [
          { name: '腌制桃肉', qty: '4.5勺/90g' },
          { name: '冷冻水蜜桃汁饮料', qty: '30ml' },
          { name: '铁观音茶汤', qty: '90ml' },
          { name: '紫苏水', qty: '50ml' },
          { name: '黄金糖', qty: '10cc' },
          { name: '紫苏叶', qty: '1 片' },
          { name: '咖啡', qty: '果咖 1 份' },
        ],
        steps: '雪克壶加腌制桃肉+水蜜桃汁+茶汤+紫苏水+黄金糖+冰块(8-10块)摇匀过滤→倒入98-520PET杯→加冰块搅匀→按「果咖」出咖啡→放紫苏叶装饰→加直饮卡口盖。配细吸管。',
      },
      {
        id: 'r13', name: '鲜果橙C美式', cat: '咖啡',
        ingredients: [
          { name: '鲜橙片', qty: '2 片' },
          { name: '橙汁复合汁', qty: '100ml' },
          { name: '七窨茉香雪芽', qty: '50ml' },
          { name: '黄金糖', qty: '10cc' },
          { name: '柠檬片', qty: '1 片' },
          { name: '咖啡', qty: '果咖 1 份' },
        ],
        steps: '雪克壶加鲜橙片→捣棒挤汁→加橙汁复合汁+七窨茉香雪芽+黄金糖+柠檬片+冰块摇匀→倒入98-520PET杯→按「果咖」出咖啡→加直饮卡口盖。配细吸管。',
      },
      {
        id: 'r14', name: '鲜果橙C拿铁', cat: '咖啡',
        ingredients: [
          { name: '橙汁复合汁', qty: '50ml' },
          { name: '鲜牛奶/高原醇牛奶', qty: '100ml' },
          { name: '黄金糖', qty: '10cc' },
          { name: 'C3 云绒轻乳', qty: '40cc' },
          { name: '净水', qty: '30ml' },
          { name: '茉莉花提取液', qty: '5cc' },
          { name: '鲜橙片', qty: '1 片' },
          { name: '咖啡', qty: '风味拿铁 1 份' },
        ],
        steps: '98-520PET 杯加橙汁复合汁+黄金糖+牛奶+C3轻乳+净水+茉莉花提取液搅匀→冰块→按「风味拿铁」出咖啡→放鲜橙片→加直饮卡口盖。配细吸管。',
      },
      {
        id: 'r15', name: '羽衣甘蓝牛油果拿铁', cat: '咖啡',
        ingredients: [
          { name: '牛油果羽衣甘蓝泥', qty: '100g' },
          { name: '黄金糖', qty: '15cc' },
          { name: 'C3 云绒轻乳', qty: '40cc' },
          { name: '冷冻椰子乳', qty: '40ml' },
          { name: '净水', qty: '70ml' },
          { name: '咖啡', qty: '风味拿铁 1 份' },
        ],
        steps: '98-520PET 杯加牛油果羽衣甘蓝泥打底→雪克壶加黄金糖+C3轻乳+椰子乳+净水搅匀→轻缓倒入杯中→冰块→浓缩咖啡(接取缓倒分层)→加直饮卡口盖。配细吸管，提醒边搅边喝。',
      },
      {
        id: 'r16', name: '开心果香椰美式', cat: '咖啡',
        ingredients: [
          { name: '冷冻香椰水', qty: '100ml' },
          { name: '黄金糖', qty: '15cc' },
          { name: '净水', qty: '50ml' },
          { name: '开心果奶盖', qty: '1 勺' },
          { name: '咖啡', qty: '风味拿铁 1 份' },
        ],
        steps: '98-520PET 杯加冷冻香椰水+黄金糖+净水搅匀→冰块→按「风味拿铁」出咖啡→加开心果奶盖→加直饮卡口盖。配细吸管。',
      },
      {
        id: 'r17', name: '开心果云顶拿铁', cat: '咖啡',
        ingredients: [
          { name: '鲜牛奶/高原醇牛奶', qty: '180ml' },
          { name: '云朵轻乳酪', qty: '20cc' },
          { name: '黄金糖', qty: '5cc' },
          { name: '开心果奶盖', qty: '1 勺' },
          { name: '咖啡', qty: '风味拿铁 1 份' },
        ],
        steps: '98-520PET 杯加牛奶+云朵轻乳酪+黄金糖→冰块搅匀→按「风味拿铁」出咖啡→加开心果奶盖→加直饮卡口盖。配细吸管。',
      },
      {
        id: 'r18', name: '电解质佛手冰咖', cat: '咖啡',
        ingredients: [
          { name: '柠檬片', qty: '1 片' },
          { name: '冰块', qty: '8-10 块' },
          { name: '佛手电解质水', qty: '190ml' },
          { name: '黄金糖', qty: '10cc' },
          { name: '净水', qty: '30ml' },
          { name: '咖啡', qty: '果咖 1 份' },
        ],
        steps: '雪克壶加柠檬片+冰块，捣棒重捶15次出香→加佛手电解质水+黄金糖+净水+冰块摇匀→倒入98-520PET杯→按「果咖」出咖啡→加直饮卡口盖。配细吸管。',
      },
      {
        id: 'r19', name: '生椰拿铁（清爽版）', cat: '咖啡',
        ingredients: [
          { name: '冷冻香椰水', qty: '40ml' },
          { name: '冷冻椰子乳', qty: '180ml' },
          { name: '黄金糖', qty: '5cc' },
          { name: '咖啡', qty: '风味拿铁 1 份' },
        ],
        steps: '98-520PET 杯加冷冻香椰水+冷冻椰子乳+黄金糖搅匀→冰块→按「风味拿铁」出咖啡→加直饮卡口盖。配细吸管。',
      },
      /* ===== 茶饮 ===== */
      {
        id: 'r20', name: '鲜奶茉莉奶绿/茉莉奶绿牛乳', cat: '真鲜奶茶·轻乳茶',
        ingredients: [
          { name: '黄金糖', qty: '25cc(中杯)/35cc(大杯)' },
          { name: '七窨茉香雪芽(茶汤)', qty: '180ml(中)/240ml(大)' },
          { name: '鲜牛奶/高原醇牛奶', qty: '60ml(中)/80ml(大)' },
          { name: 'C3 云绒轻乳', qty: '30cc(中)/35cc(大)' },
        ],
        steps: '中空纸杯加黄金糖→茶汤→鲜牛奶→C3云绒轻乳→最后加冰块→封口摇匀→加盖。配三孔吸管。',
      },
      {
        id: 'r21', name: '荔枝冰奶', cat: '真鲜奶茶·轻乳茶',
        ingredients: [
          { name: '鲜榨荔枝汁', qty: '160ml(中)/190ml(大)' },
          { name: '七窨茉香雪芽(茶汤)', qty: '90ml(中)/110ml(大)' },
          { name: '鲜牛奶/高原醇牛奶', qty: '60ml(中)/70ml(大)' },
          { name: 'C3 云绒轻乳', qty: '15cc(中)/25cc(大)' },
          { name: '净水', qty: '适量' },
        ],
        steps: '中空纸杯加鲜榨荔枝汁→茶汤→鲜牛奶→C3云绒轻乳→(净水)→冰块→封口摇匀→加盖。鲜榨荔枝汁用前摇匀。配三孔吸管。',
      },
      {
        id: 'r22', name: '蜜瓜冰奶', cat: '真鲜奶茶·轻乳茶',
        ingredients: [
          { name: '铁观音茶汤', qty: '70ml(中)/90ml(大)' },
          { name: '鲜牛奶/高原醇牛奶', qty: '60ml(中)/70ml(大)' },
          { name: 'C3 云绒轻乳', qty: '30cc(中)/35cc(大)' },
          { name: '云朵轻乳酪', qty: '10cc' },
          { name: '速冻蜜瓜果汁', qty: '110ml(中)/140ml(大)' },
          { name: '净水', qty: '20ml' },
        ],
        steps: '中空纸杯加茶汤→鲜牛奶→C3轻乳→云朵轻乳酪→速冻蜜瓜果汁→净水→冰块→封口摇匀→加盖。配三孔吸管。',
      },
      {
        id: 'r23', name: '蜜瓜冰奶（西藏版）', cat: '真鲜奶茶·轻乳茶',
        ingredients: [
          { name: '铁观音茶汤', qty: '70ml(中)/90ml(大)' },
          { name: '高原醇牛奶', qty: '60ml(中)/70ml(大)' },
          { name: 'C3 云绒轻乳', qty: '40cc(中)/45cc(大)' },
          { name: '速冻蜜瓜果汁', qty: '110ml(中)/140ml(大)' },
          { name: '净水', qty: '20ml' },
        ],
        steps: '中空纸杯加茶汤→高原醇牛奶→C3轻乳→速冻蜜瓜果汁→净水→冰块→封口摇匀→加盖。配三孔吸管。',
      },
      {
        id: 'r24', name: '杨枝甘露', cat: '水果茶',
        ingredients: [
          { name: '红西柚粒', qty: '1勺(中)/1.5勺(大)' },
          { name: '冷冻芒果浆', qty: '2勺(中)/2.5勺(大)' },
          { name: '腌制芒果粒', qty: '2勺(中)/2.5勺(大)' },
          { name: '茶百道椰浆', qty: '40ml(中)/50ml(大)' },
          { name: '黄金糖', qty: '5cc(中)/10cc(大)' },
          { name: '特奶', qty: '1勺(中)/1.3勺(大)' },
          { name: '小西米', qty: '2勺(中)/3勺(大)' },
        ],
        steps: '雪克壶加红西柚粒+冷冻芒果浆+腌制芒果粒+椰浆+黄金糖+特奶+小西米→加冰块→净水至(中450/大600)刻度线→摇匀→倒入注塑杯→去泡→封口→加盖→套杯套。配粗吸管。',
      },
      {
        id: 'r25', name: '西瓜啵啵', cat: '水果茶',
        ingredients: [
          { name: '脆啵啵', qty: '1 勺' },
          { name: '西瓜', qty: '180g(中杯)' },
          { name: '七窨茉香雪芽(茶汤)', qty: '50ml' },
          { name: '黄金糖', qty: '15cc' },
          { name: '净水', qty: '至450刻度线' },
        ],
        steps: '雪克壶加脆啵啵+西瓜+茶汤+黄金糖+冰块→摇匀→倒入杯→净水至满→封口→加盖。配粗吸管。',
      },
      {
        id: 'r26', name: '茉莉奶绿', cat: '超人气奶茶',
        ingredients: [
          { name: '黄金糖', qty: '20cc(中杯)/30cc(大杯)' },
          { name: '七窨茉香雪芽(茶汤)', qty: '160ml(中)/210ml(大)' },
          { name: '特奶', qty: '2勺(中)/2.5勺(大)' },
        ],
        steps: '注塑杯加黄金糖→茶汤→特奶→冰块→封口摇匀→加盖→套杯套。配细吸管。',
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

  /* ---------- 默认周清任务（依据两份 SOP 的清洁/设备要求整理） ---------- */
  function defaultCleanTasks() {
    return [
      { id: 'c1', area: '设备', name: '咖啡机每日清空', note: '按咖啡机「清洁维护 → 每日清空」按键执行清空，清空豆仓与渣桶，擦拭冲煮头与蒸汽棒。' },
      { id: 'c2', area: '设备', name: '制冰机内部清洗消毒', note: '断电清空后，用专用消毒液擦拭内胆与出冰口，保持无异味。' },
      { id: 'c3', area: '设备', name: '封口机刀口与拖盘清洁', note: '清除残料与糖渍，防止卡膜与异味，检查封口温度。' },
      { id: 'c4', area: '设备', name: '果糖机 / 黄金糖机除垢', note: '用温水循环清洗管路，检查出糖量与精度，防止结晶堵塞。' },
      { id: 'c5', area: '设备', name: '冰沙机 / 搅拌机消毒', note: '沙冰机完全停止后方可取下杯体，可拆卸部件拆下浸泡消毒，刀头勿碰手。' },
      { id: 'c6', area: '操作区', name: '操作台与台面深度清洁', note: '去除茶渍奶渍与糖渍，抹布消毒后擦拭，保持动线整洁。' },
      { id: 'c7', area: '操作区', name: '茶汤桶 / 量筒 / 雪克杯消毒', note: '茶汤桶用后即洗；量筒、雪克杯高温或消毒液浸泡后倒扣晾干。' },
      { id: 'c8', area: '后场', name: '冰箱除霜与整理', note: '过期原料立即处理，分类摆放、生熟分开，冷冻物料确认完全解冻状态。' },
      { id: 'c9', area: '后场', name: '排水沟与地漏清理', note: '除异味防堵塞，定期倒入管道清洁剂，保持下水畅通。' },
      { id: 'c10', area: '环境', name: '地面墙面与外场清洁', note: '重点操作区与地面油污，墙面擦至无污点；外场桌椅、玻璃门、招牌擦拭保持门店形象。' },
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
