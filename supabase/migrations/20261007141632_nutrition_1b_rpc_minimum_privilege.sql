-- Supabase's default function ACL can include service_role; this RPC is a
-- Client operation and must only be executable through authenticated.
revoke all on function public.record_nutrition_log_event(uuid,text,uuid,uuid,timestamptz,text,date,text,uuid,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.record_nutrition_log_event(uuid,text,uuid,uuid,timestamptz,text,date,text,uuid,jsonb)
  to authenticated;
revoke all on function public.record_nutrition_log_event_uncoalesced(uuid,text,uuid,uuid,timestamptz,text,date,text,uuid,jsonb)
  from public, anon, authenticated, service_role;
