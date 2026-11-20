import { lastWriteWins } from '../src/lww';
import { canAdvance } from '../src/canAdvance';
import { SEED_ITEMS, SEED_TRANSITIONS } from '../src/seed';
import type { AdmissionFields, ChecklistEntry, PatientFields } from '../src/types';

const now = Date.parse('2026-11-11T10:00:00Z');

describe('two-device airplane-mode scenarios', () => {
  it('different items both apply', () => {
    const a = lastWriteWins(null, {
      value: { done: true },
      updatedAt: now,
      deviceId: 'phone-a',
      clientMutationId: 'm-a',
      doneBy: 'doc-a',
    }, now);
    const b = lastWriteWins(null, {
      value: { cleared: 'fine' },
      updatedAt: now + 10,
      deviceId: 'phone-b',
      clientMutationId: 'm-b',
      doneBy: 'doc-b',
    }, now + 10);
    expect(a.discarded).toBeNull();
    expect(b.discarded).toBeNull();
  });

  it('same item: reconnect A then B, later timestamp wins and loser is kept', () => {
    const first = lastWriteWins(null, {
      value: { done: true },
      updatedAt: now,
      deviceId: 'phone-a',
      clientMutationId: 'm-a',
      doneBy: 'doc-a',
    }, now);
    const second = lastWriteWins(first.applied, {
      value: { done: false },
      updatedAt: now + 30_000,
      deviceId: 'phone-b',
      clientMutationId: 'm-b',
      doneBy: 'doc-b',
    }, now + 40_000);
    expect(second.applied.doneBy).toBe('doc-b');
    expect(second.discarded).toBeNull();

    const reverse = lastWriteWins(second.applied, {
      value: { done: true },
      updatedAt: now,
      deviceId: 'phone-a',
      clientMutationId: 'm-a',
      doneBy: 'doc-a',
    }, now + 50_000);
    expect(reverse.applied.doneBy).toBe('doc-b');
    expect(reverse.discarded?.doneBy).toBe('doc-a');
  });

  it('advance on A plus edit of an older item on B does not reverse the stage', () => {
    const patient: PatientFields = {
      name: 'Demo',
      age: 40,
      sex: 'male',
      father_name: 'F',
      address: 'A',
      mobile: '1',
    };
    const admission: AdmissionFields = {
      current_stage: 'post_op',
      wound_type: 'compound',
      ayushman_status: 'none',
      is_mlc: false,
      photo_consent: true,
      brought_by_name: 'B',
      brought_by_relation: 'son',
      planned_procedures: ['other'],
      surgery_date: '2026-11-10',
    };
    const entries: ChecklistEntry[] = [
      { item_key: 'blood.report', value: { cleared: 'not_fine' } },
    ];
    const move = canAdvance({
      fromStage: 'post_op',
      toStage: 'fitness',
      patient,
      admission,
      items: SEED_ITEMS,
      entries,
      transitions: SEED_TRANSITIONS,
    });
    expect(move.can).toBe(false);
    expect(admission.current_stage).toBe('post_op');
  });
});
