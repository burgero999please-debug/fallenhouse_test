-- Fallen House: Supabase 설정 (SQL Editor 에 통째로 붙여 넣고 Run · 여러 번 실행해도 안전)
create table if not exists public.fh_docs (
  path text primary key,
  coll text not null,
  data jsonb not null default '{}'::jsonb,
  owner uuid not null default auth.uid(),
  updated_at timestamptz not null default now()
);
create index if not exists fh_docs_coll_idx on public.fh_docs (coll);
alter table public.fh_docs enable row level security;
alter table public.fh_docs replica identity full;

-- 관리자 목록 (이벤트 편집기를 쓸 수 있는 계정)
create table if not exists public.fh_admins (uid uuid primary key);
alter table public.fh_admins enable row level security;
drop policy if exists fh_admins_self on public.fh_admins;
create policy fh_admins_self on public.fh_admins for select to authenticated using (uid = auth.uid());
create or replace function public.fh_is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from fh_admins where uid = auth.uid()) $$;
grant execute on function public.fh_is_admin() to authenticated;

-- 관리자 이메일: 이 이메일로 가입하면 자동으로 관리자가 됨
create table if not exists public.fh_admin_emails (email text primary key);
alter table public.fh_admin_emails enable row level security;
insert into public.fh_admin_emails (email) values ('6967894@naver.com') on conflict do nothing;
create or replace function public.fh_auto_admin() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from fh_admin_emails where lower(email) = lower(new.email)) then
    insert into fh_admins (uid) values (new.id) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists fh_auto_admin on auth.users;
create trigger fh_auto_admin after insert or update of email on auth.users for each row execute function public.fh_auto_admin();
-- 이미 가입한 계정이면 지금 바로 관리자로 등록
insert into public.fh_admins (uid) select u.id from auth.users u join public.fh_admin_emails e on lower(u.email) = lower(e.email) on conflict do nothing;

-- 읽기·쓰기 규칙
drop policy if exists fh_docs_read on public.fh_docs;
drop policy if exists fh_docs_insert on public.fh_docs;
drop policy if exists fh_docs_update on public.fh_docs;
drop policy if exists fh_docs_delete on public.fh_docs;
-- 읽기: 공용 문서는 로그인한 누구나, 개인 저장은 본인만
create policy fh_docs_read on public.fh_docs for select to authenticated using (
  path not like 'data/users/%' or path like 'data/users/' || auth.uid()::text || '/%');
-- 쓰기: 내 공개 문서·내 저장·보급 상자, 그리고 관리자만 이벤트(cevents)
create policy fh_docs_insert on public.fh_docs for insert to authenticated with check (
  owner = auth.uid() and (
    path = 'players/' || auth.uid()::text or path = 'raids/' || auth.uid()::text
    or path like 'data/users/' || auth.uid()::text || '/%' or path like 'drops/%'
    or (path like 'cevents/%' and public.fh_is_admin())));
create policy fh_docs_update on public.fh_docs for update to authenticated using (
    path = 'players/' || auth.uid()::text or path = 'raids/' || auth.uid()::text
    or path like 'data/users/' || auth.uid()::text || '/%' or path like 'drops/%'
    or (path like 'cevents/%' and public.fh_is_admin()))
  with check (owner = auth.uid() or (path like 'cevents/%' and public.fh_is_admin()));
create policy fh_docs_delete on public.fh_docs for delete to authenticated using (
  owner = auth.uid() or (path like 'cevents/%' and public.fh_is_admin()));

-- 보급 상자 동시 열기 방지용 잠금
create table if not exists public.fh_leases (path text primary key, holder uuid, until timestamptz);
alter table public.fh_leases enable row level security;
create or replace function public.fh_acquire_lease(p_path text, p_ttl_ms int)
returns boolean language plpgsql security definer set search_path = public as $$
declare got boolean;
begin
  insert into fh_leases (path, holder, until) values (p_path, auth.uid(), now() + make_interval(secs => p_ttl_ms / 1000.0))
  on conflict (path) do update set holder = excluded.holder, until = excluded.until
    where fh_leases.until < now() or fh_leases.holder = auth.uid()
  returning true into got;
  return coalesce(got, false);
end $$;
grant execute on function public.fh_acquire_lease(text, int) to authenticated;

-- 실시간 반영
do $$ begin
  alter publication supabase_realtime add table public.fh_docs;
exception when duplicate_object then null; end $$;

-- 확인용: 관리자로 등록된 계정 (가입 전이면 비어 있어도 정상)
select u.email as 관리자 from public.fh_admins a join auth.users u on u.id = a.uid;
