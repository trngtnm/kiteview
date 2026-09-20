-- Profiles + reading preferences for tailored annotations.
-- Guests use defaults in the Edge Function; signed-in users load their row via RLS.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.reading_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  reading_level text not null default 'intermediate'
    check (reading_level in ('beginner', 'intermediate', 'advanced', 'academic')),
  native_language text not null default 'en',
  explanation_language text not null default 'en',
  domain_tags text[] not null default '{}',
  tone text not null default 'conversational'
    check (tone in ('concise', 'conversational', 'formal')),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists reading_preferences_user_id_idx
  on public.reading_preferences (user_id);

alter table public.profiles enable row level security;
alter table public.reading_preferences enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "reading_preferences_select_own" on public.reading_preferences;
create policy "reading_preferences_select_own"
  on public.reading_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "reading_preferences_insert_own" on public.reading_preferences;
create policy "reading_preferences_insert_own"
  on public.reading_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "reading_preferences_update_own" on public.reading_preferences;
create policy "reading_preferences_update_own"
  on public.reading_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.reading_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
