-- Durable, immutable mapping from each accepted Trainer request key to the
-- exact version and assignment returned by that apply operation.
alter table public.nutrition_plan_versions
  add constraint nutrition_plan_versions_id_plan_client_trainer_key
  unique (id, nutrition_plan_id, client_id, trainer_id);

alter table public.client_nutrition_assignments
  add constraint client_nutrition_assignments_id_client_version_key
  unique (id, client_id, nutrition_plan_version_id);

create table private.nutrition_plan_apply_requests (
  trainer_id uuid not null,
  request_key uuid not null,
  client_id text not null,
  nutrition_plan_id uuid not null,
  nutrition_plan_version_id uuid not null,
  client_nutrition_assignment_id uuid not null,
  result_payload jsonb not null check (jsonb_typeof(result_payload) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  constraint nutrition_plan_apply_requests_pkey primary key (trainer_id, request_key),
  constraint nutrition_plan_apply_requests_plan_fkey
    foreign key (nutrition_plan_id, client_id, trainer_id)
    references public.nutrition_plan_definitions(id, client_id, trainer_id) on delete restrict,
  constraint nutrition_plan_apply_requests_version_fkey
    foreign key (nutrition_plan_version_id, nutrition_plan_id, client_id, trainer_id)
    references public.nutrition_plan_versions(id, nutrition_plan_id, client_id, trainer_id) on delete restrict,
  constraint nutrition_plan_apply_requests_assignment_fkey
    foreign key (client_nutrition_assignment_id, client_id, nutrition_plan_version_id)
    references public.client_nutrition_assignments(id, client_id, nutrition_plan_version_id) on delete restrict
);

alter table private.nutrition_plan_apply_requests enable row level security;
revoke all privileges on table private.nutrition_plan_apply_requests
  from public, anon, authenticated, service_role;

create or replace function private.guard_nutrition_apply_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Nutrition apply request mappings are immutable' using errcode = '55000';
end;
$$;
revoke all on function private.guard_nutrition_apply_request()
  from public, anon, authenticated, service_role;

create trigger nutrition_plan_apply_requests_immutable
  before update or delete on private.nutrition_plan_apply_requests
  for each row execute function private.guard_nutrition_apply_request();

-- Preserve idempotency for every operation that was already represented by an
-- assignment request_key before this ledger existed.
insert into private.nutrition_plan_apply_requests (
  trainer_id, request_key, client_id, nutrition_plan_id,
  nutrition_plan_version_id, client_nutrition_assignment_id, result_payload, created_at
)
select a.assigned_by, a.request_key, a.client_id, v.nutrition_plan_id,
       a.nutrition_plan_version_id, a.id,
       jsonb_build_object(
         'assignment_id', a.id,
         'version_id', v.id,
         'version_number', v.version_number,
         'assigned_at', a.assigned_at,
         'ended_at', null,
         'replayed', false
       ), a.assigned_at
from public.client_nutrition_assignments a
join public.nutrition_plan_versions v
  on v.id = a.nutrition_plan_version_id and v.client_id = a.client_id;

create or replace function public.apply_nutrition_plan(p_plan_id uuid, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_client_id text;
  v_trainer_id uuid;
  v_client_owner text;
  v_snapshot jsonb;
  v_version_id uuid;
  v_version_number integer;
  v_active public.client_nutrition_assignments%rowtype;
  v_existing_operation private.nutrition_plan_apply_requests%rowtype;
  v_created public.client_nutrition_assignments%rowtype;
  v_payload jsonb;
  v_now timestamptz;
  v_has_active boolean := false;
begin
  if v_uid is null or p_plan_id is null or p_request_key is null or not public.is_account_enabled() then
    raise exception 'Enabled Trainer session and request key required' using errcode = '42501';
  end if;
  select p.role into v_role from public.profiles p where p.id = v_uid;
  if v_role is distinct from 'trainer' then
    raise exception 'Only an enabled Trainer can apply a nutrition prescription' using errcode = '42501';
  end if;

  -- Serialize reuse of one key even when callers supply different plan IDs.
  -- The key is scoped to the authenticated Trainer, so this lock reveals no
  -- other Trainer's request state.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_uid::text || ':' || p_request_key::text, 0)
  );

  -- Completed keys replay before consulting mutable draft state.
  select r.* into v_existing_operation
  from private.nutrition_plan_apply_requests r
  where r.trainer_id = v_uid and r.request_key = p_request_key;
  if found then
    if v_existing_operation.nutrition_plan_id <> p_plan_id then
      raise exception 'Idempotency key already belongs to a different plan' using errcode = '23505';
    end if;
    return v_existing_operation.result_payload;
  end if;

  select d.client_id, d.trainer_id into v_client_id, v_trainer_id
  from public.nutrition_plan_definitions d where d.id = p_plan_id;
  if not found or v_trainer_id <> v_uid then
    raise exception 'Nutrition plan not found or not owned by Trainer' using errcode = '42501';
  end if;

  -- Serialize all distinct apply keys for this Client.
  select c.trainer_id::text into v_client_owner
  from public.clients c where c.id = v_client_id for update;
  if not found or v_client_owner <> v_uid::text then
    raise exception 'Client is not owned by Trainer' using errcode = '42501';
  end if;

  -- Recheck after serialization before reading the mutable draft.
  select r.* into v_existing_operation
  from private.nutrition_plan_apply_requests r
  where r.trainer_id = v_uid and r.request_key = p_request_key;
  if found then
    if v_existing_operation.nutrition_plan_id <> p_plan_id then
      raise exception 'Idempotency key already belongs to a different plan' using errcode = '23505';
    end if;
    return v_existing_operation.result_payload;
  end if;

  select d.draft_snapshot into v_snapshot
  from public.nutrition_plan_definitions d
  where d.id = p_plan_id and d.client_id = v_client_id and d.trainer_id = v_uid
  for update;
  if not found or not private.nutrition_snapshot_is_valid(v_snapshot) then
    raise exception 'Nutrition draft is invalid' using errcode = '23514';
  end if;

  select v.id, v.version_number into v_version_id, v_version_number
  from public.nutrition_plan_versions v
  where v.nutrition_plan_id = p_plan_id
  order by v.version_number desc limit 1;
  if v_version_id is null or not exists (
    select 1 from public.nutrition_plan_versions v
    where v.id = v_version_id and v.snapshot = v_snapshot
  ) then
    select coalesce(max(v.version_number), 0) + 1 into v_version_number
    from public.nutrition_plan_versions v where v.nutrition_plan_id = p_plan_id;
    insert into public.nutrition_plan_versions(nutrition_plan_id, client_id, trainer_id, version_number, snapshot, created_by)
    values (p_plan_id, v_client_id, v_uid, v_version_number, v_snapshot, v_uid)
    returning id into v_version_id;
  end if;

  select a.* into v_active
  from public.client_nutrition_assignments a
  where a.client_id = v_client_id and a.ended_at is null
  for update;
  v_has_active := found;

  if v_has_active and v_active.nutrition_plan_version_id = v_version_id then
    v_payload := jsonb_build_object(
      'assignment_id', v_active.id,
      'version_id', v_version_id,
      'version_number', v_version_number,
      'assigned_at', v_active.assigned_at,
      'ended_at', null,
      'replayed', true
    );
  else
    v_now := clock_timestamp();
    if v_has_active then
      update public.client_nutrition_assignments set ended_at = v_now where id = v_active.id;
    end if;
    insert into public.client_nutrition_assignments(client_id, nutrition_plan_version_id, assigned_by, assigned_at, request_key)
    values (v_client_id, v_version_id, v_uid, v_now, p_request_key)
    returning * into v_created;
    v_payload := jsonb_build_object(
      'assignment_id', v_created.id,
      'version_id', v_version_id,
      'version_number', v_version_number,
      'assigned_at', v_created.assigned_at,
      'ended_at', null,
      'replayed', false
    );
  end if;

  -- Every successful return is backed by a durable mapping in this same
  -- transaction. If this insert fails, version/assignment writes roll back.
  insert into private.nutrition_plan_apply_requests (
    trainer_id, request_key, client_id, nutrition_plan_id,
    nutrition_plan_version_id, client_nutrition_assignment_id, result_payload
  ) values (
    v_uid, p_request_key, v_client_id, p_plan_id,
    v_version_id, (v_payload ->> 'assignment_id')::uuid, v_payload
  );

  return v_payload;
end;
$$;

revoke all on function public.apply_nutrition_plan(uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_nutrition_plan(uuid, uuid) to authenticated;
