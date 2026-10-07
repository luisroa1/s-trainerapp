-- Nutrition 1B: append-only Client declarations of meal execution.
-- Planned remains the immutable Nutrition 1A assignment/version snapshot.

alter table public.client_nutrition_assignments
  add constraint client_nutrition_assignments_id_client_key unique (id, client_id);

create table public.nutrition_log_events (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  assignment_id uuid,
  prescribed_meal_id uuid,
  event_type text not null,
  occurred_at timestamptz not null,
  nutrition_date date not null,
  timezone_id text not null,
  recorded_at timestamptz not null default now(),
  actor_id uuid not null,
  actor_kind text not null default 'client_declaration',
  note text,
  supersedes_event_id uuid,
  constraint nutrition_log_events_client_fkey
    foreign key (client_id) references public.clients(id) on delete restrict,
  constraint nutrition_log_events_assignment_fkey
    foreign key (assignment_id, client_id)
    references public.client_nutrition_assignments(id, client_id) on delete restrict,
  constraint nutrition_log_events_actor_fkey
    foreign key (actor_id) references public.profiles(id) on delete restrict,
  constraint nutrition_log_events_id_client_key unique (id, client_id),
  constraint nutrition_log_events_supersedes_fkey
    foreign key (supersedes_event_id, client_id)
    references public.nutrition_log_events(id, client_id) on delete restrict,
  constraint nutrition_log_events_type_check
    check (event_type in ('AS_PLANNED', 'MODIFIED', 'SKIPPED', 'EXTRA', 'VOID')),
  constraint nutrition_log_events_actor_kind_check
    check (actor_kind = 'client_declaration'),
  constraint nutrition_log_events_target_check check (
    (event_type in ('AS_PLANNED', 'MODIFIED', 'SKIPPED') and assignment_id is not null and prescribed_meal_id is not null)
    or (event_type in ('EXTRA', 'VOID') and assignment_id is null and prescribed_meal_id is null)
  ),
  constraint nutrition_log_events_correction_check check (
    (event_type = 'EXTRA' and supersedes_event_id is null)
    or (event_type = 'AS_PLANNED' and (supersedes_event_id is null or assignment_id is not null))
    or (event_type = 'MODIFIED' and (supersedes_event_id is null or assignment_id is not null))
    or (event_type = 'SKIPPED' and (supersedes_event_id is null or assignment_id is not null))
    or (event_type = 'VOID' and supersedes_event_id is not null)
  ),
  constraint nutrition_log_events_local_date_check
    check (nutrition_date = (occurred_at at time zone timezone_id)::date)
);

create unique index nutrition_log_events_one_root_meal_declaration
  on public.nutrition_log_events(client_id, assignment_id, nutrition_date, prescribed_meal_id)
  where assignment_id is not null and prescribed_meal_id is not null and supersedes_event_id is null;
create unique index nutrition_log_events_one_successor
  on public.nutrition_log_events(supersedes_event_id)
  where supersedes_event_id is not null;
create index nutrition_log_events_client_date_idx
  on public.nutrition_log_events(client_id, nutrition_date desc, occurred_at desc);
create index nutrition_log_events_assignment_meal_idx
  on public.nutrition_log_events(assignment_id, prescribed_meal_id, nutrition_date desc)
  where assignment_id is not null;

create table public.nutrition_log_event_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  client_id text not null,
  operation text not null,
  planned_item_id uuid,
  label text,
  quantity numeric,
  unit text,
  energy_kcal numeric,
  protein_g numeric,
  carbohydrate_g numeric,
  fat_g numeric,
  fiber_g numeric,
  note text,
  created_at timestamptz not null default now(),
  constraint nutrition_log_event_items_event_fkey
    foreign key (event_id, client_id)
    references public.nutrition_log_events(id, client_id) on delete restrict,
  constraint nutrition_log_event_items_operation_check
    check (operation in ('change_quantity', 'removed', 'substituted', 'added')),
  constraint nutrition_log_event_items_shape_check check (
    (operation = 'change_quantity' and planned_item_id is not null and quantity is not null and label is null)
    or (operation = 'removed' and planned_item_id is not null and label is null and quantity is null and unit is null and energy_kcal is null and protein_g is null and carbohydrate_g is null and fat_g is null and fiber_g is null)
    or (operation = 'substituted' and planned_item_id is not null and label is not null)
    or (operation = 'added' and planned_item_id is null and label is not null)
  ),
  constraint nutrition_log_event_items_nonnegative_check check (
    (quantity is null or quantity >= 0)
    and (energy_kcal is null or energy_kcal >= 0)
    and (protein_g is null or protein_g >= 0)
    and (carbohydrate_g is null or carbohydrate_g >= 0)
    and (fat_g is null or fat_g >= 0)
    and (fiber_g is null or fiber_g >= 0)
  ),
  constraint nutrition_log_event_items_one_operation_per_planned_item
    unique (event_id, planned_item_id)
);
create index nutrition_log_event_items_event_idx on public.nutrition_log_event_items(event_id);

create schema if not exists private;
create table private.nutrition_log_requests (
  client_id text not null,
  request_key uuid not null,
  request_payload jsonb not null,
  declaration_fingerprint jsonb not null,
  result_event_id uuid not null,
  created_at timestamptz not null default now(),
  constraint nutrition_log_requests_pkey primary key(client_id, request_key),
  constraint nutrition_log_requests_client_fkey foreign key(client_id)
    references public.clients(id) on delete restrict,
  constraint nutrition_log_requests_result_fkey foreign key(result_event_id, client_id)
    references public.nutrition_log_events(id, client_id) on delete restrict
);
alter table private.nutrition_log_requests enable row level security;
revoke all privileges on table private.nutrition_log_requests from public, anon, authenticated, service_role;

create or replace function private.reject_nutrition_log_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Nutrition log history is append-only' using errcode = '55000';
end;
$$;
revoke all on function private.reject_nutrition_log_mutation() from public, anon, authenticated, service_role;

create trigger nutrition_log_events_immutable
  before update or delete on public.nutrition_log_events
  for each row execute function private.reject_nutrition_log_mutation();
create trigger nutrition_log_event_items_immutable
  before update or delete on public.nutrition_log_event_items
  for each row execute function private.reject_nutrition_log_mutation();
create trigger nutrition_log_requests_immutable
  before update or delete on private.nutrition_log_requests
  for each row execute function private.reject_nutrition_log_mutation();

alter table public.nutrition_log_events enable row level security;
alter table public.nutrition_log_event_items enable row level security;

create policy nutrition_log_events_select on public.nutrition_log_events
  for select to authenticated
  using (
    public.is_account_enabled()
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
    or public.is_account_enabled() and exists (
      select 1 from public.profiles p join public.clients c on c.user_id = p.id
      where p.id = (select auth.uid()) and p.role = 'client' and c.id = nutrition_log_events.client_id
    )
    or public.is_account_enabled() and exists (
      select 1 from public.profiles p join public.clients c on c.trainer_id::text = p.id::text
      where p.id = (select auth.uid()) and p.role = 'trainer' and c.id = nutrition_log_events.client_id
    )
  );
create policy nutrition_log_event_items_select on public.nutrition_log_event_items
  for select to authenticated
  using (
    public.is_account_enabled()
    and exists (select 1 from public.nutrition_log_events e where e.id = nutrition_log_event_items.event_id and e.client_id = nutrition_log_event_items.client_id)
  );

revoke all privileges on table public.nutrition_log_events, public.nutrition_log_event_items from public, anon, authenticated, service_role;
grant select on table public.nutrition_log_events, public.nutrition_log_event_items to authenticated;

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
  v_assignment public.client_nutrition_assignments%rowtype;
  v_old_request private.nutrition_log_requests%rowtype;
  v_old_event public.nutrition_log_events%rowtype;
  v_root public.nutrition_log_events%rowtype;
  v_successor public.nutrition_log_events%rowtype;
  v_event public.nutrition_log_events%rowtype;
  v_snapshot jsonb;
  v_meal jsonb;
  v_item jsonb;
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
  v_payload jsonb;
  v_fingerprint jsonb;
  v_existing_fingerprint jsonb;
  v_item_id uuid;
  v_operation text;
  v_target_assignment uuid := p_assignment_id;
  v_target_meal uuid := p_prescribed_meal_id;
  v_target_date date := p_nutrition_date;
  v_target_event_type text := p_event_type;
  v_inserted integer;
begin
  if v_actor is null or p_request_key is null or not public.is_account_enabled() then
    raise exception 'Enabled authenticated Client account required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id=v_actor and p.role='client') then
    raise exception 'Nutrition declarations can only be made by the Client' using errcode = '42501';
  end if;
  select c.id into strict v_client_id from public.clients c where c.user_id=v_actor;
  -- Per-Client serialization is the concurrency authority for declarations.
  perform 1 from public.clients c where c.id=v_client_id for update;

  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'Items must be an array' using errcode = '22023';
  end if;
  if p_event_type not in ('AS_PLANNED','MODIFIED','SKIPPED','EXTRA','VOID') then
    raise exception 'Unsupported Nutrition declaration' using errcode = '22023';
  end if;
  if p_occurred_at is null or p_nutrition_date is null or p_timezone_id is null or btrim(p_timezone_id) = '' then
    raise exception 'Occurrence time, local nutrition date, and timezone are required' using errcode = '22023';
  end if;
  if (p_occurred_at at time zone p_timezone_id)::date <> p_nutrition_date then
    raise exception 'Nutrition date must match occurred_at in timezone_id' using errcode = '22023';
  end if;

  v_payload := jsonb_build_object(
    'event_type',p_event_type,'assignment_id',p_assignment_id,'prescribed_meal_id',p_prescribed_meal_id,
    'occurred_at',p_occurred_at,'timezone_id',p_timezone_id,'nutrition_date',p_nutrition_date,
    'note',p_note,'supersedes_event_id',p_supersedes_event_id,'items',v_items
  );
  -- Distinct retries that represent the same declaration ignore their tap-time;
  -- all other declaration facts remain part of the coalescing identity.
  v_fingerprint := jsonb_build_object(
    'event_type',p_event_type,'assignment_id',p_assignment_id,'prescribed_meal_id',p_prescribed_meal_id,
    'nutrition_date',p_nutrition_date,'note',p_note,'supersedes_event_id',p_supersedes_event_id,'items',v_items
  );

  select * into v_old_request from private.nutrition_log_requests r
  where r.client_id=v_client_id and r.request_key=p_request_key;
  if found then
    if v_old_request.request_payload <> v_payload then
      raise exception 'Request key already belongs to a different Nutrition declaration' using errcode = '23505';
    end if;
    select * into strict v_old_event from public.nutrition_log_events e
    where e.id=v_old_request.result_event_id and e.client_id=v_client_id;
    return jsonb_build_object('event',to_jsonb(v_old_event),'replayed',true);
  end if;

  if p_event_type in ('AS_PLANNED','MODIFIED','SKIPPED') then
    if p_assignment_id is null or p_prescribed_meal_id is null then
      raise exception 'Prescribed meal declarations require their historical assignment and meal id' using errcode = '22023';
    end if;
    select * into v_assignment from public.client_nutrition_assignments a
    where a.id=p_assignment_id and a.client_id=v_client_id;
    if not found then raise exception 'Nutrition assignment does not belong to this Client' using errcode = '42501'; end if;
    select v.snapshot into strict v_snapshot from public.nutrition_plan_versions v
    where v.id=v_assignment.nutrition_plan_version_id and v.client_id=v_client_id;
    select m into v_meal from jsonb_array_elements(coalesce(v_snapshot->'meals','[]'::jsonb)) m
    where m->>'id'=p_prescribed_meal_id::text limit 1;
    if v_meal is null then raise exception 'Prescribed meal is absent from the assigned immutable snapshot' using errcode = '23503'; end if;
  elsif p_event_type = 'EXTRA' then
    if p_assignment_id is not null or p_prescribed_meal_id is not null or p_supersedes_event_id is not null then
      raise exception 'Extra intake cannot claim a prescribed meal or correction target' using errcode = '22023';
    end if;
  elsif p_event_type = 'VOID' then
    if p_assignment_id is not null or p_prescribed_meal_id is not null or p_supersedes_event_id is null or jsonb_array_length(v_items) <> 0 then
      raise exception 'Void must correct an Extra declaration and contain no items' using errcode = '22023';
    end if;
    select * into v_old_event from public.nutrition_log_events e
    where e.id=p_supersedes_event_id and e.client_id=v_client_id and e.event_type='EXTRA';
    if not found then raise exception 'Only an Extra declaration can be voided' using errcode = '23503'; end if;
  end if;

  if p_event_type in ('AS_PLANNED','SKIPPED','VOID') and jsonb_array_length(v_items) <> 0 then
    raise exception 'This declaration type cannot contain item deltas' using errcode = '22023';
  end if;
  if p_event_type = 'MODIFIED' and jsonb_array_length(v_items) = 0 then
    raise exception 'Modified declarations require at least one explicit item change' using errcode = '22023';
  end if;
  if p_event_type = 'EXTRA' and jsonb_array_length(v_items) = 0 then
    raise exception 'Extra declarations require at least one explicit item' using errcode = '22023';
  end if;

  if p_event_type in ('MODIFIED','EXTRA') then
    for v_item in select value from jsonb_array_elements(v_items) loop
      v_operation := v_item->>'operation';
      if v_operation not in ('change_quantity','removed','substituted','added') then
        raise exception 'Invalid item operation' using errcode = '22023';
      end if;
      if p_event_type='EXTRA' and v_operation <> 'added' then
        raise exception 'Extra items must be explicitly added items' using errcode = '22023';
      end if;
      if p_event_type='MODIFIED' and v_operation='added' and nullif(v_item->>'planned_item_id','') is not null then
        raise exception 'Added items cannot reference a Planned item' using errcode = '22023';
      end if;
      if p_event_type='MODIFIED' and v_operation <> 'added' then
        if nullif(v_item->>'planned_item_id','') is null then raise exception 'A changed Planned item requires its stable id' using errcode = '22023'; end if;
        v_item_id := (v_item->>'planned_item_id')::uuid;
        if not exists (select 1 from jsonb_array_elements(coalesce(v_meal->'items','[]'::jsonb)) i where i->>'id'=v_item_id::text) then
          raise exception 'Planned item id is absent from the assigned immutable meal' using errcode = '23503';
        end if;
      end if;
    end loop;
  end if;

  if p_supersedes_event_id is not null then
    select * into v_old_event from public.nutrition_log_events e
    where e.id=p_supersedes_event_id and e.client_id=v_client_id;
    if not found then raise exception 'Correction target does not belong to this Client' using errcode = '42501'; end if;
    if exists (select 1 from public.nutrition_log_events e where e.supersedes_event_id=p_supersedes_event_id) then
      raise exception 'Correction target is no longer the current declaration' using errcode = '23505';
    end if;
    if p_event_type <> 'VOID' and (v_old_event.assignment_id is distinct from p_assignment_id or v_old_event.prescribed_meal_id is distinct from p_prescribed_meal_id or v_old_event.nutrition_date is distinct from p_nutrition_date or v_old_event.event_type in ('EXTRA','VOID')) then
      raise exception 'Correction must keep the same prescribed meal and nutrition date' using errcode = '23514';
    end if;
    if p_event_type='VOID' and v_old_event.event_type <> 'EXTRA' then raise exception 'Only Extra can be voided' using errcode = '23514'; end if;
  elsif p_event_type in ('AS_PLANNED','MODIFIED','SKIPPED') then
    select * into v_root from public.nutrition_log_events e
    where e.client_id=v_client_id and e.assignment_id=p_assignment_id and e.prescribed_meal_id=p_prescribed_meal_id
      and e.nutrition_date=p_nutrition_date and e.supersedes_event_id is null;
    if found then
      select * into v_successor from public.nutrition_log_events e
      where e.client_id=v_client_id and e.assignment_id=p_assignment_id and e.prescribed_meal_id=p_prescribed_meal_id
        and e.nutrition_date=p_nutrition_date
        and not exists(select 1 from public.nutrition_log_events n where n.supersedes_event_id=e.id);
      if v_successor.id=v_root.id and v_fingerprint=jsonb_build_object(
        'event_type',v_root.event_type,'assignment_id',v_root.assignment_id,'prescribed_meal_id',v_root.prescribed_meal_id,
        'nutrition_date',v_root.nutrition_date,'note',v_root.note,'supersedes_event_id',v_root.supersedes_event_id,'items',
        coalesce((select jsonb_agg(jsonb_build_object('operation',i.operation,'planned_item_id',i.planned_item_id,'label',i.label,'quantity',i.quantity,'unit',i.unit,'energy_kcal',i.energy_kcal,'protein_g',i.protein_g,'carbohydrate_g',i.carbohydrate_g,'fat_g',i.fat_g,'fiber_g',i.fiber_g,'note',i.note) order by i.id) from public.nutrition_log_event_items i where i.event_id=v_root.id),'[]'::jsonb)
      ) then
        insert into private.nutrition_log_requests(client_id,request_key,request_payload,declaration_fingerprint,result_event_id)
        values(v_client_id,p_request_key,v_payload,v_fingerprint,v_root.id);
        return jsonb_build_object('event',to_jsonb(v_root),'coalesced',true);
      end if;
      raise exception 'Meal already has a declaration; corrections must supersede its current head' using errcode = '23505';
    end if;
  end if;

  if p_supersedes_event_id is not null then
    select * into v_successor from public.nutrition_log_events e where e.supersedes_event_id=p_supersedes_event_id;
    if found then raise exception 'Correction target already has a successor' using errcode = '23505'; end if;
  end if;

  insert into public.nutrition_log_events(
    client_id,assignment_id,prescribed_meal_id,event_type,occurred_at,nutrition_date,timezone_id,actor_id,note,supersedes_event_id
  ) values (
    v_client_id,v_target_assignment,v_target_meal,v_target_event_type,p_occurred_at,p_nutrition_date,p_timezone_id,v_actor,p_note,p_supersedes_event_id
  ) returning * into v_event;

  if p_event_type in ('MODIFIED','EXTRA') then
    for v_item in select value from jsonb_array_elements(v_items) loop
      insert into public.nutrition_log_event_items(
        event_id,client_id,operation,planned_item_id,label,quantity,unit,energy_kcal,protein_g,carbohydrate_g,fat_g,fiber_g,note
      ) values (
        v_event.id,v_client_id,v_item->>'operation',nullif(v_item->>'planned_item_id','')::uuid,
        nullif(v_item->>'label',''),nullif(v_item->>'quantity','')::numeric,nullif(v_item->>'unit',''),
        nullif(v_item->>'energy_kcal','')::numeric,nullif(v_item->>'protein_g','')::numeric,
        nullif(v_item->>'carbohydrate_g','')::numeric,nullif(v_item->>'fat_g','')::numeric,
        nullif(v_item->>'fiber_g','')::numeric,nullif(v_item->>'note','')
      );
    end loop;
  end if;

  insert into private.nutrition_log_requests(client_id,request_key,request_payload,declaration_fingerprint,result_event_id)
  values(v_client_id,p_request_key,v_payload,v_fingerprint,v_event.id);
  return jsonb_build_object('event',to_jsonb(v_event),'replayed',false);
end;
$$;

revoke all on function public.record_nutrition_log_event(uuid,text,uuid,uuid,timestamptz,text,date,text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.record_nutrition_log_event(uuid,text,uuid,uuid,timestamptz,text,date,text,uuid,jsonb) to authenticated;
