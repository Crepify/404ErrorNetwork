-- Run once in YOUR Supabase project's SQL editor. No credentials belong here.
-- Re-running is safe; existing publications, editors and history are preserved.
begin;
create table if not exists public.story_editor_emails (
 email text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
 enabled boolean not null default true
);
create table if not exists public.story_publications (
 id text primary key check (id = 'team'),
 projects jsonb not null default '[]'::jsonb,
 revision bigint not null default 0 check (revision >= 0),
 published_at timestamptz not null default now()
);
create table if not exists public.story_history (
 revision bigint primary key,
 projects jsonb not null,
 published_at timestamptz not null,
 published_by uuid references auth.users(id) on delete set null
);
alter table public.story_editor_emails enable row level security;
alter table public.story_publications enable row level security;
alter table public.story_history enable row level security;
revoke all on public.story_editor_emails, public.story_publications, public.story_history from anon, authenticated;
grant select on public.story_publications to anon, authenticated;
grant select on public.story_history to authenticated;
grant usage on schema public to supabase_auth_admin;
grant select on public.story_editor_emails to supabase_auth_admin;
grant select(id,email,email_confirmed_at,banned_until) on auth.users to supabase_auth_admin;

drop policy if exists "Public can read published stories" on public.story_publications;
create policy "Public can read published stories" on public.story_publications for select to anon, authenticated using (id = 'team');
drop policy if exists "Auth service reads the private allowlist" on public.story_editor_emails;
create policy "Auth service reads the private allowlist" on public.story_editor_emails for select to supabase_auth_admin using (true);
-- No anon/authenticated SELECT, INSERT, UPDATE or DELETE privileges on the list.

create or replace function public.can_publish_stories()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists (
  select 1 from auth.users u join public.story_editor_emails a on a.email = lower(u.email)
  where u.id = (select auth.uid()) and a.enabled and u.email_confirmed_at is not null
    and (u.banned_until is null or u.banned_until <= now())
 );
$$;
revoke all on function public.can_publish_stories() from public, anon, authenticated;
grant execute on function public.can_publish_stories() to authenticated;
drop policy if exists "Approved editors can read history" on public.story_history;
create policy "Approved editors can read history" on public.story_history for select to authenticated using ((select public.can_publish_stories()));

-- These hooks must ALSO be enabled in Supabase Authentication > Hooks.
-- SQL installation alone does not attach them to the Auth service.
-- They run as supabase_auth_admin with only explicit read grants, not SECURITY DEFINER.
create or replace function public.story_before_user_created_hook(event jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
begin
 if not exists (
  select 1 from public.story_editor_emails a
  where a.email = lower(btrim(event->'user'->>'email')) and a.enabled
 ) then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Editor access is restricted. Public viewing does not require an account.'));
 end if;
 return '{}'::jsonb;
end;
$$;
create or replace function public.story_access_token_hook(event jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
begin
 if not exists (
  select 1 from auth.users u join public.story_editor_emails a on a.email = lower(u.email)
  where u.id = (event->>'user_id')::uuid and a.enabled and u.email_confirmed_at is not null
    and (u.banned_until is null or u.banned_until <= now())
 ) then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Editor access is restricted. Public viewing does not require an account.'));
 end if;
 return jsonb_build_object('claims',event->'claims');
end;
$$;
revoke all on function public.story_before_user_created_hook(jsonb), public.story_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.story_before_user_created_hook(jsonb), public.story_access_token_hook(jsonb) to supabase_auth_admin;

insert into public.story_publications(id) values ('team') on conflict (id) do nothing;

create or replace function public.publish_story_collection(p_projects jsonb, p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 item jsonb; pair record; url_field text; current_revision bigint; next_revision bigint; published_time timestamptz;
 allowed_fields text[] := array['id','name','description','problemStatement','idealSolution','lessonsLearned','flagship','eventName','eventType','eventVenue','eventLocation','eventOutcome','context','tech','url','repository','linkLabel','visual'];
begin
 if auth.uid() is null or not public.can_publish_stories() then
  raise exception 'Only approved editors may publish.' using errcode = '42501';
 end if;
 if p_projects is null or jsonb_typeof(p_projects) <> 'array' then
  raise exception 'Projects must be an array.' using errcode = '22023';
 end if;
 if jsonb_array_length(p_projects) > 200 or octet_length(p_projects::text) > 2500000 then
  raise exception 'Project collection exceeds limits.' using errcode = '22023';
 end if;
 for item in select value from jsonb_array_elements(p_projects) loop
  if jsonb_typeof(item) <> 'object' or not (item ?& array['id','name','description','flagship']) then
   raise exception 'Missing required public project fields.' using errcode = '22023';
  end if;
  for pair in select key,value from jsonb_each(item) loop
   if not (pair.key = any(allowed_fields)) then
    raise exception 'Unknown or private project fields cannot be published.' using errcode = '22023';
   end if;
   if pair.key = 'flagship' then
    if jsonb_typeof(pair.value) <> 'boolean' then raise exception 'Invalid flagship.' using errcode = '22023'; end if;
   elsif jsonb_typeof(pair.value) <> 'string' or length(pair.value #>> '{}') > 20000 then
    raise exception 'Invalid project text.' using errcode = '22023';
   end if;
  end loop;
  if item->>'id' !~ '^[a-zA-Z0-9_-]{1,100}$' or length(btrim(item->>'name')) = 0 or length(item->>'name') > 160 then
   raise exception 'Invalid project ID or name.' using errcode = '22023';
  end if;
  if item ? 'visual' and item->>'visual' not in ('city','plant','signal') then raise exception 'Invalid illustration.' using errcode = '22023'; end if;
  foreach url_field in array array['url','repository'] loop
   if coalesce(item->>url_field,'') <> '' and (length(item->>url_field) > 2000 or item->>url_field !~ '^https?://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$') then
    raise exception 'Links must use HTTP(S), without embedded credentials.' using errcode = '22023';
   end if;
  end loop;
 end loop;
 if (select count(*) from jsonb_array_elements(p_projects)) <> (select count(distinct value->>'id') from jsonb_array_elements(p_projects)) then
  raise exception 'Duplicate project IDs.' using errcode = '22023';
 end if;
 if (select count(*) from jsonb_array_elements(p_projects) where value->>'flagship' = 'true') > 1 then
  raise exception 'At most one flagship is allowed.' using errcode = '22023';
 end if;
 -- Serialize publications and reject stale drafts; no last-writer-wins overwrite.
 select revision into current_revision from public.story_publications where id = 'team' for update;
 if current_revision is null then raise exception 'Story storage is not initialized.' using errcode = '22023'; end if;
 if current_revision is distinct from p_expected_revision then
  raise exception 'The online revision has changed. Merge your draft with the latest publication.' using errcode = '40001';
 end if;
 next_revision := current_revision + 1; published_time := clock_timestamp();
 update public.story_publications set projects=p_projects, revision=next_revision, published_at=published_time where id='team';
 insert into public.story_history(revision,projects,published_at,published_by) values(next_revision,p_projects,published_time,auth.uid());
 return jsonb_build_object('projects',p_projects,'revision',next_revision,'published_at',published_time);
end;
$$;
revoke all on function public.publish_story_collection(jsonb,bigint) from public, anon, authenticated;
grant execute on function public.publish_story_collection(jsonb,bigint) to authenticated;
commit;

-- Load Editor-Allowlist.private.sql separately in the owner SQL Editor.
-- It contains Archit's exact five addresses; keep it OUT of public GitHub repositories.
-- Invite only those addresses and enable BOTH Auth hooks in the dashboard.
-- To revoke an email (blocks publishing immediately and future token issuance/refresh):
-- update public.story_editor_emails set enabled=false where email='ADDRESS-TO-REVOKE';
