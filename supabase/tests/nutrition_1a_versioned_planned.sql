-- Uses existing enabled isolated identities; all fixture writes roll back.
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
with ins as (
 insert into public.nutrition_plan_definitions(client_id,trainer_id,draft_snapshot) values (
 current_setting('test.n1a_client'),current_setting('test.n1a_trainer')::uuid,
 '{"schema_version":1,"plan_name":"CORE 1A isolated V1","objective":"Validation","target_kcal":null,"targets":{"protein_g":null,"carbohydrate_g":null,"fat_g":null,"fiber_g":null,"water_l":null},"meals":[{"id":"10000000-0000-4000-8000-000000000001","name":"Meal V1","order":1,"items":[{"id":"10000000-0000-4000-8000-000000000002","label":"Item V1","description":null,"quantity":null,"unit":null,"nutrients":null,"notes":null,"alternatives":[]}]}],"notes":null}'::jsonb
 ) returning id
) select set_config('test.n1a_plan',id::text,true) from ins;
select set_config('test.n1a_assignment_v1',public.apply_nutrition_plan(current_setting('test.n1a_plan')::uuid,'20000000-0000-4000-8000-000000000001'::uuid)->>'assignment_id',true);
select set_config('test.n1a_assignment_retry',public.apply_nutrition_plan(current_setting('test.n1a_plan')::uuid,'20000000-0000-4000-8000-000000000001'::uuid)->>'assignment_id',true);
do $$ declare n integer; v uuid; begin
 if current_setting('test.n1a_assignment_v1')<>current_setting('test.n1a_assignment_retry') then raise exception 'same request key did not replay'; end if;
 select count(*) into n from public.client_nutrition_assignments where client_id=current_setting('test.n1a_client') and ended_at is null;
 if n<>1 then raise exception 'expected one active assignment'; end if;
 select nutrition_plan_version_id into v from public.client_nutrition_assignments where client_id=current_setting('test.n1a_client') and ended_at is null;
 perform set_config('test.n1a_version_v1',v::text,true);
end $$;
select set_config('test.n1a_assignment_same',public.apply_nutrition_plan(current_setting('test.n1a_plan')::uuid,'20000000-0000-4000-8000-000000000003'::uuid)->>'assignment_id',true);
do $$ begin if current_setting('test.n1a_assignment_same')<>current_setting('test.n1a_assignment_v1') then raise exception 'unchanged active version created duplicate assignment'; end if; end $$;

-- Client reads own active assignment and version, never mutable draft.
select set_config('request.jwt.claim.sub',current_setting('test.n1a_client_user'),true);
do $$ declare n integer; begin
 select count(*) into n from public.client_nutrition_assignments where id=current_setting('test.n1a_assignment_v1')::uuid; if n<>1 then raise exception 'Client cannot read own assignment'; end if;
 select count(*) into n from public.nutrition_plan_versions where id=current_setting('test.n1a_version_v1')::uuid; if n<>1 then raise exception 'Client cannot read own version'; end if;
 select count(*) into n from public.nutrition_plan_definitions where id=current_setting('test.n1a_plan')::uuid; if n<>0 then raise exception 'Client read mutable draft'; end if;
end $$;
do $$ begin begin update public.nutrition_plan_versions set snapshot='{}'::jsonb where id=current_setting('test.n1a_version_v1')::uuid; raise exception 'Client updated version'; exception when insufficient_privilege then null; end; end $$;

-- Other Client and other Trainer see no rows.
select set_config('request.jwt.claim.sub',current_setting('test.n1a_other_client_user'),true);
do $$ declare n integer; begin
 select count(*) into n from public.client_nutrition_assignments where id=current_setting('test.n1a_assignment_v1')::uuid; if n<>0 then raise exception 'Other Client read assignment'; end if;
 select count(*) into n from public.nutrition_plan_versions where id=current_setting('test.n1a_version_v1')::uuid; if n<>0 then raise exception 'Other Client read version'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.n1a_other_trainer'),true);
do $$ declare n integer; begin
 select count(*) into n from public.nutrition_plan_definitions where id=current_setting('test.n1a_plan')::uuid; if n<>0 then raise exception 'Other Trainer read draft'; end if;
 select count(*) into n from public.client_nutrition_assignments where id=current_setting('test.n1a_assignment_v1')::uuid; if n<>0 then raise exception 'Other Trainer read assignment'; end if;
 select count(*) into n from public.nutrition_plan_versions where id=current_setting('test.n1a_version_v1')::uuid; if n<>0 then raise exception 'Other Trainer read version'; end if;
end $$;

-- Trainer edits draft to V2; V1 remains immutable and assignment history is retained.
select set_config('request.jwt.claim.sub',current_setting('test.n1a_trainer'),true);
update public.nutrition_plan_definitions set draft_snapshot='{"schema_version":1,"plan_name":"CORE 1A isolated V2","objective":"Validation","target_kcal":null,"targets":{"protein_g":null,"carbohydrate_g":null,"fat_g":null,"fiber_g":null,"water_l":null},"meals":[{"id":"30000000-0000-4000-8000-000000000001","name":"Meal V2","order":1,"items":[{"id":"30000000-0000-4000-8000-000000000002","label":"Item V2","description":null,"quantity":null,"unit":null,"nutrients":null,"notes":null,"alternatives":[]}]}],"notes":null}'::jsonb where id=current_setting('test.n1a_plan')::uuid;
select set_config('test.n1a_assignment_v2',public.apply_nutrition_plan(current_setting('test.n1a_plan')::uuid,'20000000-0000-4000-8000-000000000002'::uuid)->>'assignment_id',true);
do $$ declare n integer; a public.client_nutrition_assignments%rowtype; old_version public.nutrition_plan_versions%rowtype; new_version public.nutrition_plan_versions%rowtype; begin
 select * into a from public.client_nutrition_assignments where id=current_setting('test.n1a_assignment_v1')::uuid; if a.ended_at is null then raise exception 'V1 assignment was not closed'; end if;
 select * into old_version from public.nutrition_plan_versions where id=current_setting('test.n1a_version_v1')::uuid; if old_version.snapshot->>'plan_name'<>'CORE 1A isolated V1' then raise exception 'V1 snapshot changed'; end if;
 select * into a from public.client_nutrition_assignments where id=current_setting('test.n1a_assignment_v2')::uuid;
 select * into new_version from public.nutrition_plan_versions where id=a.nutrition_plan_version_id; if new_version.snapshot->>'plan_name'<>'CORE 1A isolated V2' then raise exception 'V2 snapshot missing'; end if;
 select count(*) into n from public.client_nutrition_assignments where client_id=current_setting('test.n1a_client') and ended_at is null; if n<>1 then raise exception 'expected one active assignment after V2'; end if;
 select count(*) into n from public.nutrition_plan_versions where nutrition_plan_id=current_setting('test.n1a_plan')::uuid; if n<>2 then raise exception 'expected exactly V1 and V2'; end if;
end $$;

-- Admin's governed global read.
select set_config('request.jwt.claim.sub',current_setting('test.n1a_admin'),true);
do $$ declare n integer; begin select count(*) into n from public.nutrition_plan_versions where id=current_setting('test.n1a_version_v1')::uuid; if n<>1 then raise exception 'Admin cannot read globally'; end if; end $$;
reset role;
rollback;
