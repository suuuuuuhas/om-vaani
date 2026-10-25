-- Run once in the SQL editor of the Supabase project you choose.
-- Private server-side access only; do not put the server key in frontend code.
begin;
create table if not exists public.sessions (
  id uuid primary key,
  channel text not null,
  phone text not null,
  language text not null,
  state jsonb not null default '{}',
  turns jsonb not null default '[]',
  complaint_id uuid,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.complaints (
  id uuid primary key,
  session_id uuid not null references public.sessions(id),
  short_code text not null unique,
  phone text not null,
  language text not null,
  category text not null,
  fields jsonb not null,
  summary_user_language text,
  complaint_text_en text,
  where_to_send jsonb,
  status text not null check (status in ('drafted','ready_to_submit','submitted_by_user','resolved')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.status_events (
  id bigint generated always as identity primary key,
  complaint_id uuid not null references public.complaints(id),
  status text not null,
  note text,
  created_at timestamptz not null default now(),
  unique(complaint_id, status)
);
alter table public.sessions enable row level security;
alter table public.complaints enable row level security;
alter table public.status_events enable row level security;
revoke all on public.sessions, public.complaints, public.status_events from anon, authenticated;
grant all on public.sessions, public.complaints, public.status_events to service_role;
grant usage, select on sequence public.status_events_id_seq to service_role;

create or replace function public.save_complaint_turn(session_payload jsonb, complaint_payload jsonb default null)
returns void language plpgsql security invoker set search_path=public as $$
begin
  insert into sessions(id,channel,phone,language,state,turns,payload,created_at,updated_at)
  values ((session_payload->>'id')::uuid,session_payload->>'channel',session_payload->>'phone',
    session_payload->>'language',session_payload->'state',session_payload->'turns',session_payload,
    (session_payload->>'created_at')::timestamptz,(session_payload->>'updated_at')::timestamptz)
  on conflict(id) do update set language=excluded.language,state=excluded.state,turns=excluded.turns,
    payload=excluded.payload,updated_at=excluded.updated_at;
  if complaint_payload is not null then
    insert into complaints(id,session_id,short_code,phone,language,category,fields,summary_user_language,
      complaint_text_en,where_to_send,status,payload,created_at,updated_at)
    values ((complaint_payload->>'id')::uuid,(complaint_payload->>'session_id')::uuid,
      complaint_payload->>'short_code',complaint_payload->>'phone',complaint_payload->>'language',
      complaint_payload->>'category',complaint_payload->'fields',complaint_payload->>'summary_user_language',
      complaint_payload->>'complaint_text_en',complaint_payload->'where_to_send',complaint_payload->>'status',
      complaint_payload,(complaint_payload->>'created_at')::timestamptz,(complaint_payload->>'updated_at')::timestamptz)
    on conflict(id) do nothing;
    insert into status_events(complaint_id,status,note,created_at)
    select (complaint_payload->>'id')::uuid,e->>'status',e->>'note',(e->>'created_at')::timestamptz
    from jsonb_array_elements(complaint_payload->'status_events') as e
    on conflict(complaint_id,status) do nothing;
  end if;
  update sessions set complaint_id=nullif(session_payload->>'complaint_id','')::uuid
    where id=(session_payload->>'id')::uuid;
end;
$$;
revoke all on function public.save_complaint_turn(jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.save_complaint_turn(jsonb,jsonb) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('complaint-audio','complaint-audio',false,10485760,array['audio/ogg'])
on conflict(id) do nothing;

-- Shared limits and expiring per-session leases survive Vercel instance changes.
create table if not exists public.api_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null
);
create table if not exists public.intake_leases (
  session_id uuid primary key references public.sessions(id),
  owner uuid not null,
  expires_at timestamptz not null
);
alter table public.api_limits enable row level security;
alter table public.intake_leases enable row level security;
revoke all on public.api_limits,public.intake_leases from anon,authenticated;
grant all on public.api_limits,public.intake_leases to service_role;

create or replace function public.consume_api_limit(bucket_key text,max_count integer,period_seconds integer)
returns boolean language plpgsql security invoker set search_path=public as $$
declare actual_count integer;
begin
  insert into api_limits(key,window_start,count) values(bucket_key,now(),1)
  on conflict(key) do update set
    count=case when api_limits.window_start<=now()-make_interval(secs=>period_seconds) then 1 else api_limits.count+1 end,
    window_start=case when api_limits.window_start<=now()-make_interval(secs=>period_seconds) then now() else api_limits.window_start end
  returning count into actual_count;
  return actual_count<=max_count;
end;
$$;

create or replace function public.acquire_intake_lease(session_key uuid,owner_key uuid)
returns boolean language plpgsql security invoker set search_path=public as $$
declare acquired boolean;
begin
  insert into intake_leases(session_id,owner,expires_at) values(session_key,owner_key,now()+interval '240 seconds')
  on conflict(session_id) do update set owner=excluded.owner,expires_at=excluded.expires_at
  where intake_leases.expires_at<=now() or intake_leases.owner=owner_key
  returning true into acquired;
  return coalesce(acquired,false);
end;
$$;

create or replace function public.release_intake_lease(session_key uuid,owner_key uuid)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
  delete from intake_leases where session_id=session_key and owner=owner_key;
  return true;
end;
$$;
revoke all on function public.consume_api_limit(text,integer,integer) from public,anon,authenticated;
revoke all on function public.acquire_intake_lease(uuid,uuid) from public,anon,authenticated;
revoke all on function public.release_intake_lease(uuid,uuid) from public,anon,authenticated;
grant execute on function public.consume_api_limit(text,integer,integer) to service_role;
grant execute on function public.acquire_intake_lease(uuid,uuid) to service_role;
grant execute on function public.release_intake_lease(uuid,uuid) to service_role;
commit;
-- In Storage, add an object lifecycle cleanup policy/job for complaint-audio.
-- Signed links expire in an hour; expiration does not delete the stored object.
