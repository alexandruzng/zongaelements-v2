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
