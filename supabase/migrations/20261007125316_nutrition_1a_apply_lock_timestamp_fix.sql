-- Timestamp writes only after the per-Client lock is acquired. This avoids a
-- stale timestamp if a concurrent apply waits behind a committed assignment.
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
  v_now timestamptz;
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

  v_now := clock_timestamp();
  if found then
    update public.client_nutrition_assignments set ended_at = v_now where id = v_active.id;
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
