-- CHECK constraints on Client-written rows invoke this pure validation helper.
-- Grant only this function; no table or broader private-schema privileges.
GRANT EXECUTE ON FUNCTION private.text_array_has_no_duplicates(text[]) TO authenticated;
