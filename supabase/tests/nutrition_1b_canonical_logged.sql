-- Run against isolated only. All test rows are rolled back.
begin;
select set_config('test.n1b_trainer', (
  select p.id::text from public.profiles p join public.account_access aa on aa.user_id=p.id and aa.state='enabled'
  where p.role='trainer' and exists(select 1 from public.clients c where c.trainer_id::text=p.id::text and c.user_id is not null)
  order by p.id limit 1), true);
select set_config('test.n1b_other_trainer', (
  select p.id::text from public.profiles p join public.account_access aa on aa.user_id=p.id and aa.state='enabled'
  where p.role='trainer' and p.id::text<>current_setting('test.n1b_trainer') order by p.id limit 1), true);
select set_config('test.n1b_client', (
  select c.id from public.clients c join public.account_access aa on aa.user_id=c.user_id and aa.state='enabled'
  where c.trainer_id::text=current_setting('test.n1b_trainer') and c.user_id is not null order by c.id limit 1), true);
select set_config('test.n1b_client_user', (select c.user_id::text from public.clients c where c.id=current_setting('test.n1b_client')), true);
select set_config('test.n1b_other_client_user', (
  select c.user_id::text from public.clients c join public.account_access aa on aa.user_id=c.user_id and aa.state='enabled'
  where c.trainer_id::text=current_setting('test.n1b_trainer') and c.user_id is not null and c.id<>current_setting('test.n1b_client') order by c.id limit 1), true);
select set_config('test.n1b_admin', (
  select p.id::text from public.profiles p join public.account_access aa on aa.user_id=p.id and aa.state='enabled'
  where p.role='admin' order by p.id limit 1), true);
do $$ begin
  if current_setting('test.n1b_trainer',true) is null or current_setting('test.n1b_other_trainer',true) is null
    or current_setting('test.n1b_client',true) is null or current_setting('test.n1b_client_user',true) is null
    or current_setting('test.n1b_other_client_user',true) is null or current_setting('test.n1b_admin',true) is null then
    raise exception 'Existing enabled isolated identities for Nutrition 1B tests are required';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.n1b_trainer'),true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$
declare
  v_plan uuid;
  v_result jsonb;
  v_assignment uuid;
  v_version uuid;
  v_first uuid;
  v_retry uuid;
  v_coalesced uuid;
  v_modified uuid;
  v_skipped uuid;
  v_reinstated uuid;
  v_extra uuid;
  v_void uuid;
  v_assignment_v2 uuid;
  v_version_v2 uuid;
  v_multi_root uuid;
  v_multi_replay uuid;
  v_multi_items jsonb;
  v_reordered_items jsonb;
  v_correction_head uuid;
  v_count integer;
  v_payload jsonb := '[{"operation":"change_quantity","planned_item_id":"20000000-0000-4000-8000-000000000002","quantity":80,"unit":"g","energy_kcal":null,"protein_g":null,"carbohydrate_g":null,"fat_g":null,"fiber_g":null}]'::jsonb;
begin
  insert into public.nutrition_plan_definitions(client_id,trainer_id,draft_snapshot) values (
    current_setting('test.n1b_client'),current_setting('test.n1b_trainer')::uuid,
    '{"schema_version":1,"plan_name":"NUTRITION 1B TRANSACTION TEST","objective":null,"target_kcal":null,"targets":{"protein_g":null,"carbohydrate_g":null,"fat_g":null,"fiber_g":null,"water_l":null},"meals":[{"id":"20000000-0000-4000-8000-000000000001","name":"Meal","order":1,"description":null,"notes":null,"items":[{"id":"20000000-0000-4000-8000-000000000002","label":"Planned food","description":null,"quantity":60,"unit":"g","nutrients":null,"notes":null,"alternatives":[]}]},{"id":"20000000-0000-4000-8000-000000000011","name":"Second meal","order":2,"description":null,"notes":null,"items":[{"id":"20000000-0000-4000-8000-000000000012","label":"Planned food A","description":null,"quantity":30,"unit":"g","nutrients":null,"notes":null,"alternatives":[]},{"id":"20000000-0000-4000-8000-000000000013","label":"Planned food B","description":null,"quantity":40,"unit":"g","nutrients":null,"notes":null,"alternatives":[]}]}],"notes":null}'::jsonb
  ) returning id into v_plan;
  v_result := public.apply_nutrition_plan(v_plan,'41000000-0000-4000-8000-000000000001'::uuid);
  v_assignment := (v_result->>'assignment_id')::uuid;
  v_version := (v_result->>'version_id')::uuid;
  if v_assignment is null or v_version is null then raise exception 'Canonical Trainer apply did not return version and assignment'; end if;

  perform set_config('request.jwt.claim.sub',current_setting('test.n1b_client_user'),true);
  v_result := public.record_nutrition_log_event('30000000-0000-4000-8000-000000000001','AS_PLANNED',v_assignment,'20000000-0000-4000-8000-000000000001','2026-10-07T12:00:00Z','Europe/Madrid','2026-10-07',null,null,'[]'::jsonb);
  v_first := (v_result->'event'->>'id')::uuid;
  v_retry := (public.record_nutrition_log_event('30000000-0000-4000-8000-000000000001','AS_PLANNED',v_assignment,'20000000-0000-4000-8000-000000000001','2026-10-07T12:00:00Z','Europe/Madrid','2026-10-07',null,null,'[]'::jsonb)->'event'->>'id')::uuid;
  if v_first <> v_retry then raise exception 'Same-key retry did not return original declaration'; end if;
  v_coalesced := (public.record_nutrition_log_event('30000000-0000-4000-8000-000000000002','AS_PLANNED',v_assignment,'20000000-0000-4000-8000-000000000001','2026-10-07T12:02:00Z','Europe/Madrid','2026-10-07',null,null,'[]'::jsonb)->'event'->>'id')::uuid;
  if v_first <> v_coalesced then raise exception 'Equivalent distinct request did not coalesce'; end if;

  v_modified := (public.record_nutrition_log_event('30000000-0000-4000-8000-000000000003','MODIFIED',v_assignment,'20000000-0000-4000-8000-000000000001','2026-10-07T12:10:00Z','Europe/Madrid','2026-10-07',null,v_first,v_payload)->'event'->>'id')::uuid;
  if not exists(select 1 from public.nutrition_log_event_items i where i.event_id=v_modified and i.planned_item_id='20000000-0000-4000-8000-000000000002' and i.quantity=80 and i.energy_kcal is null) then raise exception 'Modified delta or NULL nutrient was not preserved'; end if;
  begin
    perform public.record_nutrition_log_event('30000000-0000-4000-8000-000000000004','MODIFIED',v_assignment,'20000000-0000-4000-8000-000000000001','2026-10-07T12:11:00Z','Europe/Madrid','2026-10-07',null,v_modified,'[{"operation":"removed","planned_item_id":"ffffffff-ffff-4fff-8fff-ffffffffffff"}]'::jsonb);
    raise exception 'Unknown Planned item id was accepted';
  exception when foreign_key_violation then null; end;
  v_skipped := (public.record_nutrition_log_event('30000000-0000-4000-8000-000000000005','SKIPPED',v_assignment,'20000000-0000-4000-8000-000000000001','2026-10-07T12:12:00Z','Europe/Madrid','2026-10-07',null,v_modified,'[]'::jsonb)->'event'->>'id')::uuid;
  v_reinstated := (public.record_nutrition_log_event('30000000-0000-4000-8000-000000000006','AS_PLANNED',v_assignment,'20000000-0000-4000-8000-000000000001','2026-10-07T12:13:00Z','Europe/Madrid','2026-10-07',null,v_skipped,'[]'::jsonb)->'event'->>'id')::uuid;

  v_multi_items := '[{"operation":"change_quantity","planned_item_id":"20000000-0000-4000-8000-000000000012","quantity":35,"unit":"g"},{"operation":"change_quantity","planned_item_id":"20000000-0000-4000-8000-000000000013","quantity":45,"unit":"g"}]'::jsonb;
  v_multi_root := (public.record_nutrition_log_event('30000000-0000-4000-8000-000000000012','MODIFIED',v_assignment,'20000000-0000-4000-8000-000000000011','2026-10-07T13:00:00Z','Europe/Madrid','2026-10-07',null,null,v_multi_items)->'event'->>'id')::uuid;
  select jsonb_agg(jsonb_build_object('operation',i.operation,'planned_item_id',i.planned_item_id,'label',i.label,'quantity',i.quantity,'unit',i.unit,'energy_kcal',i.energy_kcal,'protein_g',i.protein_g,'carbohydrate_g',i.carbohydrate_g,'fat_g',i.fat_g,'fiber_g',i.fiber_g,'note',i.note) order by i.id desc)
  into v_reordered_items from public.nutrition_log_event_items i where i.event_id=v_multi_root;
  v_multi_replay := (public.record_nutrition_log_event('30000000-0000-4000-8000-000000000013','MODIFIED',v_assignment,'20000000-0000-4000-8000-000000000011','2026-10-07T13:01:00Z','Europe/Madrid','2026-10-07',null,null,v_reordered_items)->'event'->>'id')::uuid;
  if v_multi_root<>v_multi_replay then raise exception 'Equivalent multi-item declarations did not coalesce independent of item ordering'; end if;

  v_correction_head := (public.record_nutrition_log_event('30000000-0000-4000-8000-000000000014','SKIPPED',v_assignment,'20000000-0000-4000-8000-000000000001','2026-10-07T12:14:00Z','Europe/Madrid','2026-10-07',null,v_reinstated,'[]'::jsonb)->'event'->>'id')::uuid;
  v_retry := (public.record_nutrition_log_event('30000000-0000-4000-8000-000000000015','SKIPPED',v_assignment,'20000000-0000-4000-8000-000000000001','2026-10-07T12:15:00Z','Europe/Madrid','2026-10-07',null,v_reinstated,'[]'::jsonb)->'event'->>'id')::uuid;
  if v_retry<>v_correction_head then raise exception 'Equivalent concurrent correction did not coalesce to its successor'; end if;

  -- An old idempotency key replays the original fact and does not change the current head.
  v_retry := (public.record_nutrition_log_event('30000000-0000-4000-8000-000000000001','AS_PLANNED',v_assignment,'20000000-0000-4000-8000-000000000001','2026-10-07T12:00:00Z','Europe/Madrid','2026-10-07',null,null,'[]'::jsonb)->'event'->>'id')::uuid;
  if v_retry <> v_first or not exists(select 1 from public.nutrition_log_events where id=v_reinstated and supersedes_event_id=v_skipped) then raise exception 'Replay altered correction chain'; end if;

  v_extra := (public.record_nutrition_log_event('30000000-0000-4000-8000-000000000007','EXTRA',null,null,'2026-10-07T20:00:00Z','Europe/Madrid','2026-10-07',null,null,'[{"operation":"added","label":"Extra food","quantity":null,"unit":null,"energy_kcal":null,"protein_g":null,"carbohydrate_g":null,"fat_g":null,"fiber_g":null}]'::jsonb)->'event'->>'id')::uuid;
  v_void := (public.record_nutrition_log_event('30000000-0000-4000-8000-000000000008','VOID',null,null,'2026-10-07T20:01:00Z','Europe/Madrid','2026-10-07',null,v_extra,'[]'::jsonb)->'event'->>'id')::uuid;
  if not exists(select 1 from public.nutrition_log_events where id=v_void and event_type='VOID' and supersedes_event_id=v_extra) then raise exception 'Extra void was not retained as audit history'; end if;
  if exists(select 1 from public.nutrition_log_event_items where event_id=v_extra and energy_kcal is not null) then raise exception 'Unknown nutrient became a number'; end if;
  if exists(select 1 from public.nutrition_log_events e where e.client_id=current_setting('test.n1b_client') and e.assignment_id=v_assignment and e.prescribed_meal_id='20000000-0000-4000-8000-000000000001' and e.nutrition_date='2026-10-07' and not exists(select 1 from public.nutrition_log_events n where n.supersedes_event_id=e.id) and e.id<>v_correction_head) then raise exception 'More than one current prescribed-meal head'; end if;
  if exists(select 1 from public.nutrition_log_events e where e.id in (v_first,v_modified,v_skipped,v_reinstated) and e.client_id<>current_setting('test.n1b_client')) then raise exception 'Client attribution mismatch'; end if;

  begin
    perform public.record_nutrition_log_event('30000000-0000-4000-8000-000000000001','SKIPPED',v_assignment,'20000000-0000-4000-8000-000000000001','2026-10-07T12:00:00Z','Europe/Madrid','2026-10-07',null,null,'[]'::jsonb);
    raise exception 'Incompatible reuse of request key was accepted';
  exception when unique_violation then null; end;
  begin
    perform public.record_nutrition_log_event('30000000-0000-4000-8000-000000000011','AS_PLANNED',v_assignment,'20000000-0000-4000-8000-000000000001','2026-10-07T23:30:00Z','Europe/Madrid','2026-10-07',null,null,'[]'::jsonb);
    raise exception 'Mismatched local date and timezone was accepted';
  exception when invalid_parameter_value then null; end;

  -- A later assignment/version cannot reinterpret declarations attached to V1.
  perform set_config('request.jwt.claim.sub',current_setting('test.n1b_trainer'),true);
  update public.nutrition_plan_definitions set draft_snapshot = jsonb_set(
    draft_snapshot,'{meals}',
    '[{"id":"40000000-0000-4000-8000-000000000001","name":"Meal V2","order":1,"description":null,"notes":null,"items":[]}]'::jsonb
  ) where id=v_plan;
  v_result := public.apply_nutrition_plan(v_plan,'41000000-0000-4000-8000-000000000002'::uuid);
  v_assignment_v2 := (v_result->>'assignment_id')::uuid;
  v_version_v2 := (v_result->>'version_id')::uuid;
  if v_assignment_v2=v_assignment or v_version_v2=v_version then raise exception 'Changed draft did not create a new logical version and assignment'; end if;
  perform set_config('request.jwt.claim.sub',current_setting('test.n1b_client_user'),true);
  v_retry := (public.record_nutrition_log_event('30000000-0000-4000-8000-000000000001','AS_PLANNED',v_assignment,'20000000-0000-4000-8000-000000000001','2026-10-07T12:00:00Z','Europe/Madrid','2026-10-07',null,null,'[]'::jsonb)->'event'->>'id')::uuid;
  if v_retry<>v_first or not exists(select 1 from public.client_nutrition_assignments where client_id=current_setting('test.n1b_client') and id=v_assignment_v2 and ended_at is null) then raise exception 'Old retry after V2 changed history or reactivated V1'; end if;
  perform set_config('request.jwt.claim.sub',current_setting('test.n1b_trainer'),true);
  if not exists(select 1 from public.nutrition_log_events e join public.client_nutrition_assignments a on a.id=e.assignment_id join public.nutrition_plan_versions v on v.id=a.nutrition_plan_version_id where e.id=v_first and e.assignment_id=v_assignment and v.id=v_version and v.snapshot->'meals'->0->>'id'='20000000-0000-4000-8000-000000000001') then raise exception 'Historical event no longer resolves through its original V1 assignment snapshot'; end if;
  perform set_config('request.jwt.claim.sub',current_setting('test.n1b_client_user'),true);

  -- Current Client can read its own facts; another Client cannot.
  select count(*) into v_count from public.nutrition_log_events where id=v_first;
  if v_count <> 1 then raise exception 'Client cannot read own event'; end if;
  begin
    insert into public.nutrition_log_events(client_id,event_type,occurred_at,nutrition_date,timezone_id,actor_id)
    values(current_setting('test.n1b_client'),'EXTRA','2026-10-07T20:00:00Z','2026-10-07','Europe/Madrid',current_setting('test.n1b_client_user')::uuid);
    raise exception 'Client bypassed the controlled write operation';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',current_setting('test.n1b_other_client_user'),true);
  select count(*) into v_count from public.nutrition_log_events where id=v_first;
  if v_count <> 0 then raise exception 'Other Client read a private declaration'; end if;
  begin
    perform public.record_nutrition_log_event('30000000-0000-4000-8000-000000000009','AS_PLANNED',v_assignment,'20000000-0000-4000-8000-000000000001','2026-10-07T12:00:00Z','Europe/Madrid','2026-10-07',null,null,'[]'::jsonb);
    raise exception 'Other Client wrote a declaration';
  exception when insufficient_privilege then null; end;

  perform set_config('request.jwt.claim.sub',current_setting('test.n1b_other_trainer'),true);
  select count(*) into v_count from public.nutrition_log_events where id=v_first;
  if v_count <> 0 then raise exception 'Other Trainer read a declaration'; end if;
  perform set_config('request.jwt.claim.sub',current_setting('test.n1b_trainer'),true);
  select count(*) into v_count from public.nutrition_log_events where id=v_first;
  if v_count <> 1 then raise exception 'Owning Trainer cannot read declaration'; end if;
  begin
    perform public.record_nutrition_log_event('30000000-0000-4000-8000-000000000010','AS_PLANNED',v_assignment,'20000000-0000-4000-8000-000000000001','2026-10-07T12:00:00Z','Europe/Madrid','2026-10-07',null,null,'[]'::jsonb);
    raise exception 'Trainer wrote Client declaration';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',current_setting('test.n1b_admin'),true);
  select count(*) into v_count from public.nutrition_log_events where id=v_first;
  if v_count <> 1 then raise exception 'Admin governance read failed'; end if;
end $$;

reset role;
do $$ declare n integer; begin
  select count(*) into n from private.nutrition_log_requests where client_id=current_setting('test.n1b_client') and request_key::text like '30000000-0000-4000-8000-%';
  if n<>11 then raise exception 'Successful and coalesced request mappings were not durable'; end if;
end $$;
set local role anon;
do $$ begin
  begin perform 1 from public.nutrition_log_events; raise exception 'Anonymous role read Nutrition logs';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
