-- Authenticated Trainers insert/update only their own draft rows. CHECK
-- constraints execute this pure validator as the caller, so expose only the
-- non-sensitive validation helpers in the non-API private schema.
grant usage on schema private to authenticated;
grant execute on function private.nutrition_optional_nonnegative_number(jsonb, text) to authenticated;
grant execute on function private.nutrition_snapshot_is_valid(jsonb) to authenticated;
