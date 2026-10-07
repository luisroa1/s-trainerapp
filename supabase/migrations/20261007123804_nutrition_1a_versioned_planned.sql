-- Nutrition 1A: canonical Planned nutrition. Legacy nutrition_plans rows/data
-- remain untouched and are no longer a client-facing source of truth.

create schema if not exists private;

create or replace function private.nutrition_optional_nonnegative_number(
  p_object jsonb,
  p_key text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_object is null or jsonb_typeof(p_object) <> 'object' then false
    when not (p_object ? p_key) then true
    when jsonb_typeof(p_object -> p_key) = 'null' then true
    when jsonb_typeof(p_object -> p_key) <> 'number' then false
    else (p_object ->> p_key)::numeric >= 0
  end;
$$;

create or replace function private.nutrition_snapshot_is_valid(p_snapshot jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_meal jsonb;
  v_item jsonb;
  v_ids uuid[] := array[]::uuid[];
  v_id uuid;
  v_nutrients jsonb;
  v_order integer;
begin
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object'
     or p_snapshot ->> 'schema_version' <> '1'
     or jsonb_typeof(p_snapshot -> 'plan_name') <> 'string'
     or length(btrim(p_snapshot ->> 'plan_name')) = 0
     or jsonb_typeof(p_snapshot -> 'targets') <> 'object'
     or jsonb_typeof(p_snapshot -> 'meals') <> 'array' then
    return false;
  end if;

  if (p_snapshot ? 'objective' and jsonb_typeof(p_snapshot -> 'objective') not in ('string', 'null'))
     or not private.nutrition_optional_nonnegative_number(p_snapshot, 'target_kcal') then
    return false;
  end if;

  if not private.nutrition_optional_nonnegative_number(p_snapshot -> 'targets', 'protein_g')
     or not private.nutrition_optional_nonnegative_number(p_snapshot -> 'targets', 'carbohydrate_g')
     or not private.nutrition_optional_nonnegative_number(p_snapshot -> 'targets', 'fat_g')
     or not private.nutrition_optional_nonnegative_number(p_snapshot -> 'targets', 'fiber_g')
     or not private.nutrition_optional_nonnegative_number(p_snapshot -> 'targets', 'water_l') then
    return false;
  end if;

  for v_meal in select value from jsonb_array_elements(p_snapshot -> 'meals') as meal(value) loop
    if jsonb_typeof(v_meal) <> 'object'
       or jsonb_typeof(v_meal -> 'id') <> 'string'
       or jsonb_typeof(v_meal -> 'name') <> 'string'
       or length(btrim(v_meal ->> 'name')) = 0
       or jsonb_typeof(v_meal -> 'order') <> 'number'
       or (v_meal ->> 'order') !~ '^[0-9]+$'
       or jsonb_typeof(v_meal -> 'items') <> 'array' then
      return false;
    end if;
    begin
      v_id := (v_meal ->> 'id')::uuid;
      v_order := (v_meal ->> 'order')::integer;
    exception when others then
      return false;
    end;
    if v_order < 1 or v_id = any(v_ids) then return false; end if;
    v_ids := array_append(v_ids, v_id);
    if (v_meal ? 'notes' and jsonb_typeof(v_meal -> 'notes') not in ('string', 'null')) then return false; end if;

    for v_item in select value from jsonb_array_elements(v_meal -> 'items') as item(value) loop
      if jsonb_typeof(v_item) <> 'object'
         or jsonb_typeof(v_item -> 'id') <> 'string'
         or jsonb_typeof(v_item -> 'label') <> 'string'
         or length(btrim(v_item ->> 'label')) = 0 then
        return false;
      end if;
      begin
        v_id := (v_item ->> 'id')::uuid;
      exception when others then
        return false;
      end;
      if v_id = any(v_ids) then return false; end if;
      v_ids := array_append(v_ids, v_id);
      if (v_item ? 'description' and jsonb_typeof(v_item -> 'description') not in ('string', 'null'))
         or (v_item ? 'unit' and jsonb_typeof(v_item -> 'unit') not in ('string', 'null'))
         or (v_item ? 'notes' and jsonb_typeof(v_item -> 'notes') not in ('string', 'null'))
         or (v_item ? 'alternatives' and jsonb_typeof(v_item -> 'alternatives') not in ('array', 'null'))
         or not private.nutrition_optional_nonnegative_number(v_item, 'quantity') then
        return false;
      end if;
      v_nutrients := v_item -> 'nutrients';
      if v_nutrients is not null and jsonb_typeof(v_nutrients) not in ('object', 'null') then return false; end if;
      if jsonb_typeof(v_nutrients) = 'object'
         and (not private.nutrition_optional_nonnegative_number(v_nutrients, 'energy_kcal')
           or not private.nutrition_optional_nonnegative_number(v_nutrients, 'protein_g')
           or not private.nutrition_optional_nonnegative_number(v_nutrients, 'carbohydrate_g')
           or not private.nutrition_optional_nonnegative_number(v_nutrients, 'fat_g')
           or not private.nutrition_optional_nonnegative_number(v_nutrients, 'fiber_g')) then
        return false;
      end if;
    end loop;
  end loop;
  return true;
end;
$$;

create table public.nutrition_plan_definitions (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  trainer_id uuid not null,
  draft_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_plan_definitions_client_fkey
    foreign key (client_id) references public.clients(id) on delete restrict,
  constraint nutrition_plan_definitions_trainer_fkey
    foreign key (trainer_id) references public.profiles(id) on delete restrict,
  constraint nutrition_plan_definitions_id_client_trainer_key unique (id, client_id, trainer_id),
  constraint nutrition_plan_definitions_snapshot_check
    check (private.nutrition_snapshot_is_valid(draft_snapshot))
);

create table public.nutrition_plan_versions (
  id uuid primary key default gen_random_uuid(),
  nutrition_plan_id uuid not null,
  client_id text not null,
  trainer_id uuid not null,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null,
  created_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint nutrition_plan_versions_identity_fkey
    foreign key (nutrition_plan_id, client_id, trainer_id)
    references public.nutrition_plan_definitions(id, client_id, trainer_id) on delete restrict,
  constraint nutrition_plan_versions_client_fkey
    foreign key (client_id) references public.clients(id) on delete restrict,
  constraint nutrition_plan_versions_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete restrict,
  constraint nutrition_plan_versions_number_key unique (nutrition_plan_id, version_number),
  constraint nutrition_plan_versions_id_client_key unique (id, client_id),
  constraint nutrition_plan_versions_snapshot_check
    check (private.nutrition_snapshot_is_valid(snapshot))
);

create table public.client_nutrition_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  nutrition_plan_version_id uuid not null,
  assigned_by uuid not null,
  assigned_at timestamptz not null default clock_timestamp(),
  ended_at timestamptz,
  request_key uuid not null unique,
  constraint client_nutrition_assignments_client_fkey
    foreign key (client_id) references public.clients(id) on delete restrict,
  constraint client_nutrition_assignments_version_client_fkey
    foreign key (nutrition_plan_version_id, client_id)
    references public.nutrition_plan_versions(id, client_id) on delete restrict,
  constraint client_nutrition_assignments_assigned_by_fkey
    foreign key (assigned_by) references public.profiles(id) on delete restrict,
  constraint client_nutrition_assignments_dates_check
    check (ended_at is null or ended_at >= assigned_at)
);

create unique index client_nutrition_assignments_one_active_per_client
  on public.client_nutrition_assignments(client_id) where ended_at is null;
create index nutrition_plan_versions_plan_created_idx
  on public.nutrition_plan_versions(nutrition_plan_id, version_number desc);
create index client_nutrition_assignments_client_history_idx
  on public.client_nutrition_assignments(client_id, assigned_at desc);

create or replace function private.guard_nutrition_immutable_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Nutrition history is immutable' using errcode = '55000';
end;
$$;

create or replace function private.guard_nutrition_plan_definition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Nutrition plan identities cannot be deleted' using errcode = '55000';
  end if;
  if (to_jsonb(new) - 'draft_snapshot' - 'updated_at') is distinct from
     (to_jsonb(old) - 'draft_snapshot' - 'updated_at') then
    raise exception 'Nutrition plan ownership and identity are immutable' using errcode = '55000';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create or replace function private.guard_client_nutrition_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Nutrition assignment history cannot be deleted' using errcode = '55000';
  end if;
  if old.ended_at is not null or new.ended_at is null
     or (to_jsonb(new) - 'ended_at') is distinct from (to_jsonb(old) - 'ended_at')
     or new.ended_at < old.assigned_at then
    raise exception 'Only an active nutrition assignment may be ended' using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function private.nutrition_optional_nonnegative_number(jsonb, text) from public, anon, authenticated, service_role;
revoke all on function private.nutrition_snapshot_is_valid(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.guard_nutrition_immutable_row() from public, anon, authenticated, service_role;
revoke all on function private.guard_nutrition_plan_definition() from public, anon, authenticated, service_role;
revoke all on function private.guard_client_nutrition_assignment() from public, anon, authenticated, service_role;

create trigger nutrition_plan_versions_immutable
  before update or delete on public.nutrition_plan_versions
  for each row execute function private.guard_nutrition_immutable_row();
create trigger nutrition_plan_definitions_guard
  before update or delete on public.nutrition_plan_definitions
  for each row execute function private.guard_nutrition_plan_definition();
create trigger client_nutrition_assignments_guard
  before update or delete on public.client_nutrition_assignments
  for each row execute function private.guard_client_nutrition_assignment();

alter table public.nutrition_plan_definitions enable row level security;
alter table public.nutrition_plan_versions enable row level security;
alter table public.client_nutrition_assignments enable row level security;

create policy nutrition_plan_definitions_select on public.nutrition_plan_definitions
  for select to authenticated
  using (
    public.is_account_enabled()
    and (
      public.is_admin()
      or (
        trainer_id = (select auth.uid())
        and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'trainer')
        and exists (select 1 from public.clients c where c.id = nutrition_plan_definitions.client_id and c.trainer_id::text = (select auth.uid())::text)
      )
    )
  );
create policy nutrition_plan_definitions_insert on public.nutrition_plan_definitions
  for insert to authenticated
  with check (
    public.is_account_enabled()
    and trainer_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'trainer')
    and exists (select 1 from public.clients c where c.id = nutrition_plan_definitions.client_id and c.trainer_id::text = (select auth.uid())::text)
  );
create policy nutrition_plan_definitions_update on public.nutrition_plan_definitions
  for update to authenticated
  using (
    public.is_account_enabled()
    and trainer_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'trainer')
    and exists (select 1 from public.clients c where c.id = nutrition_plan_definitions.client_id and c.trainer_id::text = (select auth.uid())::text)
  )
  with check (
    public.is_account_enabled()
    and trainer_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'trainer')
    and exists (select 1 from public.clients c where c.id = nutrition_plan_definitions.client_id and c.trainer_id::text = (select auth.uid())::text)
  );

create policy nutrition_plan_versions_select on public.nutrition_plan_versions
  for select to authenticated
  using (
    public.is_account_enabled()
    and (
      public.is_admin()
      or (
        trainer_id = (select auth.uid())
        and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'trainer')
        and exists (select 1 from public.clients c where c.id = nutrition_plan_versions.client_id and c.trainer_id::text = (select auth.uid())::text)
      )
      or exists (
        select 1
        from public.client_nutrition_assignments a
        join public.clients c on c.id = a.client_id
        where a.nutrition_plan_version_id = nutrition_plan_versions.id
          and a.client_id = nutrition_plan_versions.client_id
          and a.ended_at is null
          and c.user_id = (select auth.uid())
      )
    )
  );

create policy client_nutrition_assignments_select on public.client_nutrition_assignments
  for select to authenticated
  using (
    public.is_account_enabled()
    and (
      public.is_admin()
      or exists (
        select 1 from public.clients c
        where c.id = client_nutrition_assignments.client_id
          and c.trainer_id::text = (select auth.uid())::text
          and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'trainer')
      )
      or (
        ended_at is null
        and exists (select 1 from public.clients c where c.id = client_nutrition_assignments.client_id and c.user_id = (select auth.uid()))
      )
    )
  );

-- Existing nutrition_plans is kept intact as legacy data. Remove the old
-- broad grants and prevent Clients from treating its mutable JSON as Planned.
revoke all privileges on table public.nutrition_plans from public, anon, authenticated, service_role;
grant select on table public.nutrition_plans to authenticated;
drop policy if exists nutrition_select on public.nutrition_plans;
drop policy if exists nutrition_insert on public.nutrition_plans;
drop policy if exists nutrition_update on public.nutrition_plans;
drop policy if exists nutrition_delete on public.nutrition_plans;
drop policy if exists nutrition_legacy_select on public.nutrition_plans;
create policy nutrition_legacy_select on public.nutrition_plans
  for select to authenticated
  using (
    public.is_account_enabled()
    and (
      public.is_admin()
      or (
        trainer_id::text = (select auth.uid())::text
        and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'trainer')
      )
    )
  );

revoke all privileges on table public.nutrition_plan_definitions,
  public.nutrition_plan_versions, public.client_nutrition_assignments
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.nutrition_plan_definitions to authenticated;
grant select on table public.nutrition_plan_versions, public.client_nutrition_assignments to authenticated;

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
  v_existing public.client_nutrition_assignments%rowtype;
  v_created public.client_nutrition_assignments%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if v_uid is null or p_plan_id is null or p_request_key is null or not public.is_account_enabled() then
    raise exception 'Enabled Trainer session and request key required' using errcode = '42501';
  end if;
  select p.role into v_role from public.profiles p where p.id = v_uid;
  if v_role is distinct from 'trainer' then
    raise exception 'Only an enabled Trainer can apply a nutrition prescription' using errcode = '42501';
  end if;

  select d.client_id, d.trainer_id into v_client_id, v_trainer_id
  from public.nutrition_plan_definitions d where d.id = p_plan_id;
  if not found or v_trainer_id <> v_uid then
    raise exception 'Nutrition plan not found or not owned by Trainer' using errcode = '42501';
  end if;

  select c.trainer_id::text into v_client_owner
  from public.clients c where c.id = v_client_id for update;
  if not found or v_client_owner <> v_uid::text then
    raise exception 'Client is not owned by Trainer' using errcode = '42501';
  end if;

  select d.draft_snapshot into v_snapshot
  from public.nutrition_plan_definitions d
  where d.id = p_plan_id and d.client_id = v_client_id and d.trainer_id = v_uid
  for update;
  if not found or not private.nutrition_snapshot_is_valid(v_snapshot) then
    raise exception 'Nutrition draft is invalid' using errcode = '23514';
  end if;

  select a.* into v_existing from public.client_nutrition_assignments a where a.request_key = p_request_key;
  if found then
    if v_existing.assigned_by <> v_uid or v_existing.client_id <> v_client_id then
      raise exception 'Idempotency key already used for a different operation' using errcode = '23505';
    end if;
    return jsonb_build_object('assignment_id', v_existing.id, 'version_id', v_existing.nutrition_plan_version_id,
      'assigned_at', v_existing.assigned_at, 'ended_at', v_existing.ended_at, 'replayed', true);
  end if;

  select v.id, v.version_number into v_version_id, v_version_number
  from public.nutrition_plan_versions v
  where v.nutrition_plan_id = p_plan_id
  order by v.version_number desc limit 1;
  if v_version_id is null or not exists (
    select 1 from public.nutrition_plan_versions v where v.id = v_version_id and v.snapshot = v_snapshot
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
  if found and v_active.nutrition_plan_version_id = v_version_id then
    return jsonb_build_object('assignment_id', v_active.id, 'version_id', v_version_id,
      'assigned_at', v_active.assigned_at, 'ended_at', v_active.ended_at, 'replayed', true);
  end if;
  if found then
    update public.client_nutrition_assignments
      set ended_at = v_now where id = v_active.id;
  end if;
  insert into public.client_nutrition_assignments(client_id, nutrition_plan_version_id, assigned_by, assigned_at, request_key)
  values (v_client_id, v_version_id, v_uid, v_now, p_request_key)
  returning * into v_created;

  return jsonb_build_object('assignment_id', v_created.id, 'version_id', v_version_id,
    'version_number', v_version_number, 'assigned_at', v_created.assigned_at, 'ended_at', null, 'replayed', false);
end;
$$;

revoke all on function public.apply_nutrition_plan(uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_nutrition_plan(uuid, uuid) to authenticated;
