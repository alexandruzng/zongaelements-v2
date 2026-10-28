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
  if p_tool not in ('planner', 'habits', 'finance') then raise exception 'bad tool'; end if;
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
alter table public.user_data add constraint user_data_tool_check check (tool in ('planner', 'habits', 'finance'));
