-- Normalize item order/content for distinct request-key reconciliation.
-- The first version remains installed and immutable as a migration; this
-- wrapper only reconciles equivalent concurrent declarations it rejected.

alter function public.record_nutrition_log_event(uuid,text,uuid,uuid,timestamptz,text,date,text,uuid,jsonb)
  rename to record_nutrition_log_event_uncoalesced;
revoke all on function public.record_nutrition_log_event_uncoalesced(uuid,text,uuid,uuid,timestamptz,text,date,text,uuid,jsonb)
  from public, anon, authenticated;

create or replace function private.nutrition_log_item_fingerprint(p_items jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(normalized.value order by normalized.value::text), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'operation', item.value->>'operation',
      'planned_item_id', nullif(item.value->>'planned_item_id','')::uuid,
      'label', nullif(item.value->>'label',''),
      'quantity', nullif(item.value->>'quantity','')::numeric,
      'unit', nullif(item.value->>'unit',''),
      'energy_kcal', nullif(item.value->>'energy_kcal','')::numeric,
      'protein_g', nullif(item.value->>'protein_g','')::numeric,
      'carbohydrate_g', nullif(item.value->>'carbohydrate_g','')::numeric,
      'fat_g', nullif(item.value->>'fat_g','')::numeric,
      'fiber_g', nullif(item.value->>'fiber_g','')::numeric,
      'note', nullif(item.value->>'note','')
    ) as value
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item(value)
  ) normalized;
$$;

create or replace function private.nutrition_log_event_items_fingerprint(p_event_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'operation', i.operation,
    'planned_item_id', i.planned_item_id,
    'label', i.label,
    'quantity', i.quantity,
    'unit', i.unit,
    'energy_kcal', i.energy_kcal,
    'protein_g', i.protein_g,
    'carbohydrate_g', i.carbohydrate_g,
    'fat_g', i.fat_g,
    'fiber_g', i.fiber_g,
    'note', i.note
  ) order by jsonb_build_object(
    'operation', i.operation,
    'planned_item_id', i.planned_item_id,
    'label', i.label,
    'quantity', i.quantity,
    'unit', i.unit,
    'energy_kcal', i.energy_kcal,
    'protein_g', i.protein_g,
    'carbohydrate_g', i.carbohydrate_g,
    'fat_g', i.fat_g,
    'fiber_g', i.fiber_g,
    'note', i.note
  )::text), '[]'::jsonb)
  from public.nutrition_log_event_items i where i.event_id = p_event_id;
$$;
revoke all on function private.nutrition_log_item_fingerprint(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.nutrition_log_event_items_fingerprint(uuid) from public, anon, authenticated, service_role;

create or replace function public.record_nutrition_log_event(
  p_request_key uuid,
  p_event_type text,
  p_assignment_id uuid,
  p_prescribed_meal_id uuid,
  p_occurred_at timestamptz,
  p_timezone_id text,
  p_nutrition_date date,
  p_note text default null,
  p_supersedes_event_id uuid default null,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_client_id text;
  v_payload jsonb;
  v_fingerprint jsonb;
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
  v_request private.nutrition_log_requests%rowtype;
  v_event public.nutrition_log_events%rowtype;
  v_root public.nutrition_log_events%rowtype;
  v_head public.nutrition_log_events%rowtype;
  v_coalesced public.nutrition_log_events%rowtype;
begin
  if v_actor is null or p_request_key is null or not public.is_account_enabled()
    or not exists(select 1 from public.profiles p where p.id=v_actor and p.role='client') then
    raise exception 'Enabled authenticated Client account required' using errcode = '42501';
  end if;
  select c.id into strict v_client_id from public.clients c where c.user_id=v_actor;
  perform 1 from public.clients c where c.id=v_client_id for update;

  v_payload := jsonb_build_object(
    'event_type',p_event_type,'assignment_id',p_assignment_id,'prescribed_meal_id',p_prescribed_meal_id,
    'occurred_at',p_occurred_at,'timezone_id',p_timezone_id,'nutrition_date',p_nutrition_date,
    'note',p_note,'supersedes_event_id',p_supersedes_event_id,'items',v_items
  );
  v_fingerprint := jsonb_build_object(
    'event_type',p_event_type,'assignment_id',p_assignment_id,'prescribed_meal_id',p_prescribed_meal_id,
    'nutrition_date',p_nutrition_date,'note',p_note,'supersedes_event_id',p_supersedes_event_id,
    'items',private.nutrition_log_item_fingerprint(v_items)
  );
  select * into v_request from private.nutrition_log_requests r
  where r.client_id=v_client_id and r.request_key=p_request_key;
  if found then
    if v_request.request_payload <> v_payload then
      raise exception 'Request key already belongs to a different Nutrition declaration' using errcode = '23505';
    end if;
    select * into strict v_event from public.nutrition_log_events e
    where e.id=v_request.result_event_id and e.client_id=v_client_id;
    return jsonb_build_object('event',to_jsonb(v_event),'replayed',true);
  end if;

  begin
    return public.record_nutrition_log_event_uncoalesced(
      p_request_key,p_event_type,p_assignment_id,p_prescribed_meal_id,p_occurred_at,
      p_timezone_id,p_nutrition_date,p_note,p_supersedes_event_id,v_items
    );
  exception when unique_violation then
    -- A distinct key may represent the same declaration that won the Client lock.
    -- Compare canonical item sets (order is not semantically meaningful) before
    -- recording the second durable request mapping.
    if p_supersedes_event_id is not null then
      select * into v_coalesced from public.nutrition_log_events e
      where e.client_id=v_client_id and e.supersedes_event_id=p_supersedes_event_id
        and e.event_type=p_event_type and e.assignment_id is not distinct from p_assignment_id
        and e.prescribed_meal_id is not distinct from p_prescribed_meal_id
        and e.nutrition_date=p_nutrition_date and e.note is not distinct from p_note
        and e.event_type <> 'VOID'
        and private.nutrition_log_event_items_fingerprint(e.id)=private.nutrition_log_item_fingerprint(v_items)
      limit 1;
    elsif p_event_type in ('AS_PLANNED','MODIFIED','SKIPPED') then
      select * into v_root from public.nutrition_log_events e
      where e.client_id=v_client_id and e.assignment_id=p_assignment_id
        and e.prescribed_meal_id=p_prescribed_meal_id and e.nutrition_date=p_nutrition_date
        and e.supersedes_event_id is null;
      if found then
        select * into v_head from public.nutrition_log_events e
        where e.client_id=v_client_id and e.assignment_id=p_assignment_id
          and e.prescribed_meal_id=p_prescribed_meal_id and e.nutrition_date=p_nutrition_date
          and not exists(select 1 from public.nutrition_log_events n where n.supersedes_event_id=e.id);
        if v_head.id=v_root.id and v_root.event_type=p_event_type and v_root.note is not distinct from p_note
          and private.nutrition_log_event_items_fingerprint(v_root.id)=private.nutrition_log_item_fingerprint(v_items) then
          v_coalesced := v_root;
        end if;
      end if;
    end if;

    if v_coalesced.id is null then raise; end if;
    insert into private.nutrition_log_requests(client_id,request_key,request_payload,declaration_fingerprint,result_event_id)
    values(v_client_id,p_request_key,v_payload,v_fingerprint,v_coalesced.id);
    return jsonb_build_object('event',to_jsonb(v_coalesced),'coalesced',true);
  end;
end;
$$;

revoke all on function public.record_nutrition_log_event(uuid,text,uuid,uuid,timestamptz,text,date,text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.record_nutrition_log_event(uuid,text,uuid,uuid,timestamptz,text,date,text,uuid,jsonb) to authenticated;
