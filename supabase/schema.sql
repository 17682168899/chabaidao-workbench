-- 茶百道工作台 · Supabase 建表脚本
-- 在 Supabase 控制台 SQL Editor 中粘贴执行即可。
--
-- 设计说明：
--   为保持与现有前端逻辑最小改动，排班总数据与物料数据各用「单行 jsonb」存储，
--   通过实时订阅（REALTIME）实现多人/多设备秒级同步。
--   排班数据含员工密码（沿用原有演示模型），仅适合内部小工具；
--   如需生产级安全，请改用 Supabase Auth + 行级安全策略（RLS）。

-- 1) 排班总数据（employees / currentWeek / schedules / settings 打包成一个 JSON）
create table if not exists app_state (
  id          text primary key,
  value       jsonb not null,
  updated_at  timestamptz default now()
);

-- 2) 物料数据（物料数组）
create table if not exists materials_state (
  id          text primary key,
  value       jsonb not null,
  updated_at  timestamptz default now()
);

-- 3) 行级安全（RLS）
--    这里对「匿名角色 anon」开放全部权限，便于纯前端直接读写。
--    注意：anon key 会随前端代码公开，任何人都能读写。仅适合内部/演示场景。
--    生产环境请改为：启用邮箱密码登录（Supabase Auth），并写更严格的 RLS 策略。
alter table app_state enable row level security;
alter table materials_state enable row level security;

drop policy if exists "anon_all_app" on app_state;
create policy "anon_all_app" on app_state for all to anon using (true) with check (true);

drop policy if exists "anon_all_mat" on materials_state;
create policy "anon_all_mat" on materials_state for all to anon using (true) with check (true);

-- 4) 开启实时发布（前端 .subscribe 依赖此配置）
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime with (publish = 'insert, update, delete, truncate');
  end if;
end $$;

alter publication supabase_realtime add table app_state;
alter publication supabase_realtime add table materials_state;
