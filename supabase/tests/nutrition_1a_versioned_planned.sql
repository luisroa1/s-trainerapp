-- Uses existing enabled isolated identities; every write rolls back.
begin;
select set_config('test.n1a_trainer', (
 select p.id::text from public.profiles p join public.account_access aa on aa.user_id=p.id and aa.state='enabled'
 where p.role='trainer' and exists(select 1 from public.clients c where c.trainer_id::text=p.id::text and c.user_id is not null)
 order by p.id limit 1), true);
select set_config('test.n1a_other_trainer', (
 select p.id::text from public.profiles p join public.account_access aa on aa.user_id=p.id and aa.state='enabled'
 where p.role='trainer' and p.id::text<>current_setting('test.n1a_trainer') order by p.id limit 1), true);
select set_config('test.n1a_client', (
 select c.id from public.clients c where c.trainer_id::text=current_setting('test.n1a_trainer') and c.user_id is not null order by c.id limit 1), true);
select set_config('test.n1a_client_user', (select c.user_id::text from public.clients c where c.id=current_setting('test.n1a_client')), true);
select set_config('test.n1a_other_client_user', (
 select c.user_id::text from public.clients c where c.trainer_id::text=current_setting('test.n1a_trainer') and c.user_id is not null and c.id<>current_setting('test.n1a_client') order by c.id limit 1), true);
select set_config('test.n1a_admin', (
 select p.id::text from public.profiles p join public.account_access aa on aa.user_id=p.id and aa.state='enabled' where p.role='admin' order by p.id limit 1), true);
do $$ begin
 if current_setting('test.n1a_trainer',true) is null or current_setting('test.n1a_other_trainer',true) is null or current_setting('test.n1a_client',true) is null or current_setting('test.n1a_client_user',true) is null or current_setting('test.n1a_other_client_user',true) is null or current_setting('test.n1a_admin',true) is null then raise exception 'Existing isolated identities required'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.n1a_trainer'),true);
select set_config('request.jwt.claim.role','authenticated',true);
insert into public.nutrition_plan_definitions(client_id,trainer_id,draft_snapshot) values (
 current_setting('test.n1a_client'),current_setting('test.n1a_trainer')::uuid,
 '{"schema_version":1,"plan_name":"CORE 1A isolated V1","objective":"Validation","target_kcal":null,"targets":{"protein_g":null,"carbohydrate_g":null,"fat_g":null,"fiber_g":null,"water_l":null},"meals":[{"id":"10000000-0000-4000-8000-000000000001","name":"Meal V1","order":1,"items":[{"id":"10000000-0000-4000-8000-000000000002","label":"Item V1","description":null,"quantity":null,"unit":null,"nutrients":null,"notes":null,"alternatives":[]}]}],"notes":null}'::jsonb
) returning id;
select set_config('test.n1a_plan', (select id::text from public.nutrition_plan_definitions where draft_snapshot->>'plan_name'='CORE 1A isolated V1' order by created_at desc limit 1), true);

-- A creates V1; retry A must replay exactly and create nothing else.
select set_config('test.n1a_a_first',public.apply_nutrition_plan(current_setting('test.n1a_plan')::uuid,'20000000-0000-4000-8000-000000000001'::uuid)::text,true);
select set_config('test.n1a_a_retry',public.apply_nutrition_plan(current_setting('test.n1a_plan')::uuid,'20000000-0000-4000-8000-000000000001'::uuid)::text,true);
do $$ declare first_result jsonb; retry_result jsonb; n integer; begin
 first_result:=current_setting('test.n1a_a_first')::jsonb; retry_result:=current_setting('test.n1a_a_retry')::jsonb;
 if first_result->>'assignment_id'<>retry_result->>'assignment_id' or first_result->>'version_id'<>retry_result->>'version_id' then raise exception 'A retry changed the logical result'; end if;
 select count(*) into n from public.nutrition_plan_versions where nutrition_plan_id=current_setting('test.n1a_plan')::uuid; if n<>1 then raise exception 'A retry created another version'; end if;
 select count(*) into n from public.client_nutrition_assignments a join public.nutrition_plan_versions v on v.id=a.nutrition_plan_version_id where a.client_id=current_setting('test.n1a_client') and v.nutrition_plan_id=current_setting('test.n1a_plan')::uuid; if n<>1 then raise exception 'A retry created another assignment'; end if;
end $$;
select set_config('test.n1a_assignment_v1',(current_setting('test.n1a_a_first')::jsonb->>'assignment_id'),true);
select set_config('test.n1a_version_v1',(current_setting('test.n1a_a_first')::jsonb->>'version_id'),true);
do $$ begin
 begin perform public.apply_nutrition_plan('ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid,'20000000-0000-4000-8000-000000000001'::uuid); raise exception 'Conflicting plan context was accepted';
 exception when unique_violation then null; end;
end $$;

-- Client can read its active assignment/version, not the mutable draft.
select set_config('request.jwt.claim.sub',current_setting('test.n1a_client_user'),true);
do $$ declare n integer; begin
 select count(*) into n from public.client_nutrition_assignments where id=current_setting('test.n1a_assignment_v1')::uuid; if n<>1 then raise exception 'Client cannot read own assignment'; end if;
 select count(*) into n from public.nutrition_plan_versions where id=current_setting('test.n1a_version_v1')::uuid; if n<>1 then raise exception 'Client cannot read own version'; end if;
 select count(*) into n from public.nutrition_plan_definitions where id=current_setting('test.n1a_plan')::uuid; if n<>0 then raise exception 'Client read mutable draft'; end if;
end $$;
do $$ begin begin update public.nutrition_plan_versions set snapshot='{}'::jsonb where id=current_setting('test.n1a_version_v1')::uuid; raise exception 'Client updated version'; exception when insufficient_privilege then null; end; end $$;
do $$ begin
 begin update public.client_nutrition_assignments set ended_at=clock_timestamp() where id=current_setting('test.n1a_assignment_v1')::uuid; raise exception 'Client modified assignment'; exception when insufficient_privilege then null; end;
 begin perform public.apply_nutrition_plan(current_setting('test.n1a_plan')::uuid,'20000000-0000-4000-8000-000000000004'::uuid); raise exception 'Client applied a nutrition plan'; exception when insufficient_privilege then null; end;
end $$;

-- Trainer edits the draft. B coalesces to V1 and its own key is durably mapped.
select set_config('request.jwt.claim.sub',current_setting('test.n1a_trainer'),true);
select set_config('test.n1a_b_coalesced',public.apply_nutrition_plan(current_setting('test.n1a_plan')::uuid,'20000000-0000-4000-8000-000000000002'::uuid)::text,true);
do $$ begin
 if current_setting('test.n1a_b_coalesced')::jsonb->>'assignment_id'<>current_setting('test.n1a_assignment_v1') then raise exception 'B did not coalesce to V1 assignment'; end if;
 if current_setting('test.n1a_b_coalesced')::jsonb->>'version_id'<>current_setting('test.n1a_version_v1') then raise exception 'B did not coalesce to V1 version'; end if;
end $$;
select set_config('test.n1a_b_retry_after_edit',public.apply_nutrition_plan(current_setting('test.n1a_plan')::uuid,'20000000-0000-4000-8000-000000000002'::uuid)::text,true);
do $$ begin
 if current_setting('test.n1a_b_retry_after_edit')::jsonb->>'assignment_id'<>current_setting('test.n1a_assignment_v1') then raise exception 'B retry after edit changed assignment'; end if;
 if current_setting('test.n1a_b_retry_after_edit')::jsonb->>'version_id'<>current_setting('test.n1a_version_v1') then raise exception 'B retry after edit changed version'; end if;
end $$;

update public.nutrition_plan_definitions set draft_snapshot='{"schema_version":1,"plan_name":"CORE 1A isolated V2","objective":"Validation","target_kcal":null,"targets":{"protein_g":null,"carbohydrate_g":null,"fat_g":null,"fiber_g":null,"water_l":null},"meals":[{"id":"30000000-0000-4000-8000-000000000001","name":"Meal V2","order":1,"items":[{"id":"30000000-0000-4000-8000-000000000002","label":"Item V2","description":null,"quantity":null,"unit":null,"nutrients":null,"notes":null,"alternatives":[]}]}],"notes":null}'::jsonb where id=current_setting('test.n1a_plan')::uuid;

-- C intentionally applies V2. A/B remain historical replays and cannot reactivate V1.
select set_config('test.n1a_c_v2',public.apply_nutrition_plan(current_setting('test.n1a_plan')::uuid,'20000000-0000-4000-8000-000000000003'::uuid)::text,true);
select set_config('test.n1a_a_after_v2',public.apply_nutrition_plan(current_setting('test.n1a_plan')::uuid,'20000000-0000-4000-8000-000000000001'::uuid)::text,true);
select set_config('test.n1a_b_after_v2',public.apply_nutrition_plan(current_setting('test.n1a_plan')::uuid,'20000000-0000-4000-8000-000000000002'::uuid)::text,true);
do $$ declare n integer; v public.nutrition_plan_versions%rowtype; a public.client_nutrition_assignments%rowtype; begin
 if current_setting('test.n1a_a_after_v2')::jsonb->>'assignment_id'<>current_setting('test.n1a_assignment_v1') or current_setting('test.n1a_a_after_v2')::jsonb->>'version_id'<>current_setting('test.n1a_version_v1') then raise exception 'A replay changed after V2'; end if;
 if current_setting('test.n1a_b_after_v2')::jsonb->>'assignment_id'<>current_setting('test.n1a_assignment_v1') or current_setting('test.n1a_b_after_v2')::jsonb->>'version_id'<>current_setting('test.n1a_version_v1') then raise exception 'B replay changed after V2'; end if;
 select count(*) into n from public.nutrition_plan_versions where nutrition_plan_id=current_setting('test.n1a_plan')::uuid; if n<>2 then raise exception 'Expected exactly V1 and V2'; end if;
 select * into v from public.nutrition_plan_versions where id=current_setting('test.n1a_version_v1')::uuid; if v.snapshot->>'plan_name'<>'CORE 1A isolated V1' then raise exception 'V1 snapshot changed'; end if;
 select * into a from public.client_nutrition_assignments where id=(current_setting('test.n1a_c_v2')::jsonb->>'assignment_id')::uuid;
 if a.ended_at is not null or a.nutrition_plan_version_id=(current_setting('test.n1a_version_v1'))::uuid then raise exception 'C did not leave V2 active'; end if;
 select count(*) into n from public.client_nutrition_assignments where client_id=current_setting('test.n1a_client') and ended_at is null; if n<>1 then raise exception 'Expected exactly one active assignment'; end if;
end $$;

-- RLS isolation and Admin governance.
select set_config('request.jwt.claim.sub',current_setting('test.n1a_other_client_user'),true);
do $$ declare n integer; begin select count(*) into n from public.client_nutrition_assignments where id=current_setting('test.n1a_assignment_v1')::uuid; if n<>0 then raise exception 'Other Client read assignment'; end if; select count(*) into n from public.nutrition_plan_versions where id=current_setting('test.n1a_version_v1')::uuid; if n<>0 then raise exception 'Other Client read version'; end if; end $$;
select set_config('request.jwt.claim.sub',current_setting('test.n1a_other_trainer'),true);
do $$ declare n integer; begin select count(*) into n from public.nutrition_plan_definitions where id=current_setting('test.n1a_plan')::uuid; if n<>0 then raise exception 'Other Trainer read draft'; end if; select count(*) into n from public.client_nutrition_assignments where id=current_setting('test.n1a_assignment_v1')::uuid; if n<>0 then raise exception 'Other Trainer read assignment'; end if; select count(*) into n from public.nutrition_plan_versions where id=current_setting('test.n1a_version_v1')::uuid; if n<>0 then raise exception 'Other Trainer read version'; end if; end $$;
do $$ begin begin perform public.apply_nutrition_plan(current_setting('test.n1a_plan')::uuid,'20000000-0000-4000-8000-000000000004'::uuid); raise exception 'Other Trainer applied plan'; exception when insufficient_privilege then null; end; end $$;
select set_config('request.jwt.claim.sub',current_setting('test.n1a_admin'),true);
do $$ declare n integer; begin select count(*) into n from public.nutrition_plan_versions where id=current_setting('test.n1a_version_v1')::uuid; if n<>1 then raise exception 'Admin cannot read versions globally'; end if; select count(*) into n from public.nutrition_plan_definitions where id=current_setting('test.n1a_plan')::uuid; if n<>1 then raise exception 'Admin cannot read definitions globally'; end if; select count(*) into n from public.client_nutrition_assignments where id=(current_setting('test.n1a_c_v2')::jsonb->>'assignment_id')::uuid; if n<>1 then raise exception 'Admin cannot read assignments globally'; end if; end $$;

reset role;
do $$ declare n integer; begin
 select count(*) into n from private.nutrition_plan_apply_requests where nutrition_plan_id=current_setting('test.n1a_plan')::uuid;
 if n<>3 then raise exception 'Every successful key A/B/C must have a durable mapping'; end if;
end $$;
rollback;
