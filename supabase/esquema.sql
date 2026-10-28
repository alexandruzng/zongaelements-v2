-- =========================================================
-- ZongaElements · Esquema de Supabase
-- Pega este archivo entero en Supabase → SQL Editor → Run.
-- =========================================================

-- Una fila por usuario y herramienta, con todo su estado en JSON.
create table if not exists public.user_data (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  tool       text        not null check (tool in ('planner', 'habits')),
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, tool)
);

-- Acceso desde la web solo para usuarios con sesión iniciada
-- (el proyecto se crea con "Automatically expose new tables" desactivado).
revoke all on public.user_data from anon;
grant select, insert, update, delete on public.user_data to authenticated;

-- Seguridad: cada persona solo puede ver y tocar sus propios datos.
alter table public.user_data enable row level security;

drop policy if exists "leer mis datos"      on public.user_data;
drop policy if exists "crear mis datos"     on public.user_data;
drop policy if exists "actualizar mis datos" on public.user_data;
drop policy if exists "borrar mis datos"    on public.user_data;

create policy "leer mis datos"       on public.user_data for select using (auth.uid() = user_id);
create policy "crear mis datos"      on public.user_data for insert with check (auth.uid() = user_id);
create policy "actualizar mis datos" on public.user_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "borrar mis datos"     on public.user_data for delete using (auth.uid() = user_id);

-- =========================================================
-- Protección de datos (2026-10-18)
-- Todo es re-ejecutable: puedes pegar este archivo entero otra vez.
-- =========================================================

-- 1) La fecha de cada guardado la pone el servidor (no el reloj del móvil),
--    así la web detecta con seguridad si otro dispositivo guardó después.
create or replace function public.user_data_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists user_data_touch on public.user_data;
create trigger user_data_touch before insert or update on public.user_data
  for each row execute function public.user_data_touch();

-- 2) Copias de seguridad automáticas por usuario y herramienta.
--    Se guarda la versión anterior como mucho cada 6 horas, siempre antes de
--    un borrado o de un cambio que vacíe los datos, y se conservan las 20 últimas.
create table if not exists public.user_data_history (
  id       bigint generated always as identity primary key,
  user_id  uuid        not null references auth.users (id) on delete cascade,
  tool     text        not null,
  data     jsonb       not null,
  saved_at timestamptz not null default now()
);
create index if not exists user_data_history_user_tool on public.user_data_history (user_id, tool, saved_at desc);

alter table public.user_data_history enable row level security;
revoke all on public.user_data_history from anon, authenticated;
grant select on public.user_data_history to authenticated;
drop policy if exists "ver mis copias" on public.user_data_history;
create policy "ver mis copias" on public.user_data_history for select using (auth.uid() = user_id);

create or replace function public.user_data_snapshot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE'
     or pg_column_size(new.data) < pg_column_size(old.data) / 2
     or not exists (select 1 from user_data_history h
                    where h.user_id = old.user_id and h.tool = old.tool
                      and h.saved_at > now() - interval '6 hours') then
    insert into user_data_history (user_id, tool, data) values (old.user_id, old.tool, old.data);
    delete from user_data_history where id in (
      select id from user_data_history
      where user_id = old.user_id and tool = old.tool
      order by saved_at desc offset 20);
  end if;
  return null;
end $$;
drop trigger if exists user_data_snapshot on public.user_data;
create trigger user_data_snapshot after update or delete on public.user_data
  for each row execute function public.user_data_snapshot();

-- 3) "Ping" para la tarea diaria que evita que el proyecto gratis se pause.
create or replace function public.ping() returns text
language sql stable as $$ select 'ok' $$;
revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;

-- 4) Guardar una copia a petición de la web (antes de restaurar o de resolver
--    un conflicto entre dispositivos), para que ninguna versión se pierda.
create or replace function public.add_backup(p_tool text, p_data jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
declare d jsonb := p_data;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_tool not in ('planner', 'habits', 'finance', 'orders') then raise exception 'bad tool'; end if;
  if d is null then
    select data into d from user_data where user_id = auth.uid() and tool = p_tool;
  end if;
  if d is null then return; end if;
  insert into user_data_history (user_id, tool, data) values (auth.uid(), p_tool, d);
  delete from user_data_history where id in (
    select id from user_data_history
    where user_id = auth.uid() and tool = p_tool
    order by saved_at desc offset 20);
end $$;
revoke all on function public.add_backup(text, jsonb) from public;
grant execute on function public.add_backup(text, jsonb) to authenticated;

-- =========================================================
-- Herramienta Finanzas (2026-10-28)
-- Amplía la lista de herramientas permitidas (re-ejecutable).
-- =========================================================
alter table public.user_data drop constraint if exists user_data_tool_check;
alter table public.user_data add constraint user_data_tool_check check (tool in ('planner', 'habits', 'finance', 'orders'));

-- =========================================================
-- Avisos de suscripciones (notificaciones push) · 2026-10-29
-- Re-ejecutable.
-- =========================================================

-- 1) Dispositivos que quieren avisos (uno por navegador / iPhone).
create table if not exists public.push_subs (
  endpoint   text        primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  p256dh     text        not null,
  auth       text        not null,
  lang       text        not null default 'es',
  ua         text,
  created_at timestamptz not null default now(),
  last_ok    timestamptz
);
create index if not exists push_subs_user on public.push_subs (user_id);
revoke all on public.push_subs from anon;
grant select, insert, update, delete on public.push_subs to authenticated;
alter table public.push_subs enable row level security;
drop policy if exists "ver mis avisos"     on public.push_subs;
drop policy if exists "crear mis avisos"   on public.push_subs;
drop policy if exists "cambiar mis avisos" on public.push_subs;
drop policy if exists "borrar mis avisos"  on public.push_subs;
create policy "ver mis avisos"     on public.push_subs for select using (auth.uid() = user_id);
create policy "crear mis avisos"   on public.push_subs for insert with check (auth.uid() = user_id);
create policy "cambiar mis avisos" on public.push_subs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "borrar mis avisos"  on public.push_subs for delete using (auth.uid() = user_id);

-- 2) Avisos ya enviados (para no repetir el mismo aviso). Solo lo usa la función.
create table if not exists public.push_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  sub_id  text not null,
  charge  date not null,
  days    int  not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, sub_id, charge, days)
);
alter table public.push_sent enable row level security;
revoke all on public.push_sent from anon, authenticated;

-- 3) Tarea cada hora: la función solo envía a partir de las 14:00 (hora de Rumanía).
--    El secreto real NO va en este archivo: se pone al programar la tarea.
-- la función de avisos usa la clave de servicio (las tablas nuevas no se exponen solas)
grant select, insert, update, delete on public.push_subs, public.push_sent to service_role;
grant select on public.user_data to service_role;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
-- select cron.schedule('avisos-suscripciones', '0 * * * *', $$
--   select net.http_post(
--     url := 'https://kzlhjyvayrrqvviczhlo.supabase.co/functions/v1/avisos-suscripciones',
--     headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
--     body := '{}'::jsonb)
-- $$);
