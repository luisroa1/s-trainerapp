import test from 'node:test';
import assert from 'node:assert/strict';
import { clientDataWithoutLegacyAssignment, readAssignedProgramId } from '../src/lib/clientAssignment.mjs';

test('SQL NULL means no assignment and does not fall back to stale JSON', () => {
  assert.equal(readAssignedProgramId({ assigned_program_id: null, data: { assignedProgramId: 'prog-stale' } }), '');
});

test('the SQL assignment is the only assignment returned when JSON disagrees', () => {
  assert.equal(readAssignedProgramId({ assigned_program_id: 'prog-current', data: { assignedProgramId: 'prog-stale' } }), 'prog-current');
});

test('generic client persistence strips the legacy JSON assignment copy', () => {
  const data = clientDataWithoutLegacyAssignment({ id: 'client-1', assignedProgramId: 'prog-old', name: 'Client' });
  assert.deepEqual(data, { id: 'client-1', name: 'Client' });
  assert.equal(Object.hasOwn(data, 'assignedProgramId'), false);
});
