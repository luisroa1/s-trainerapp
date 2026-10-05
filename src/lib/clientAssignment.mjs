// SQL assigned_program_id is authoritative. The JSON property is compatibility
// data only and must never restore an assignment when the SQL value is NULL.
export function readAssignedProgramId(row) {
  return row?.assigned_program_id ?? '';
}

// Generic clients upserts do not assign programs. invite-client remains the
// sole assignment writer; strip the legacy JSON copy on subsequent writes.
export function clientDataWithoutLegacyAssignment(client) {
  const { assignedProgramId: _ignored, ...data } = client;
  return data;
}
