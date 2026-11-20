import { canAdvance, gateStillHolds } from '../src/canAdvance';
import { isRegistrationComplete } from '../src/registration';
import { SEED_ITEMS, SEED_TRANSITIONS } from '../src/seed';
import { isClientAllowed, compareClientColumns } from '../src/version';
import type { ChecklistEntry, PatientFields, AdmissionFields } from '../src/types';

const adult: PatientFields = {
  name: 'Ravi Kumar',
  age: 62,
  sex: 'male',
  father_name: 'Ram',
  address: 'Patna',
  mobile: '9876543210',
};

const baseAdmission: AdmissionFields = {
  brought_by_name: 'Sita',
  brought_by_relation: 'wife',
  is_mlc: false,
  ayushman_status: 'applied',
  photo_consent: true,
  wound_type: 'compound',
  planned_procedures: ['THR'],
  current_stage: 'registration',
  status: 'active',
};

function entries(map: Record<string, unknown>): ChecklistEntry[] {
  return Object.entries(map).map(([item_key, value]) => ({ item_key, value: value as Record<string, unknown> }));
}

describe('registration', () => {
  it('requires identity fields and a phone', () => {
    expect(isRegistrationComplete({ name: 'A' }, {}).can).toBe(false);
    expect(isRegistrationComplete(adult, baseAdmission).can).toBe(true);
    expect(isRegistrationComplete({ ...adult, mobile: null }, { ...baseAdmission, brought_by_phone: null }).can).toBe(
      false,
    );
  });
});

describe('state machine', () => {
  it('rejects an edge that is not in the table', () => {
    const r = canAdvance({
      fromStage: 'registration',
      toStage: 'post_op',
      patient: adult,
      admission: baseAdmission,
      items: SEED_ITEMS,
      entries: [],
      transitions: SEED_TRANSITIONS,
    });
    expect(r.can).toBe(false);
  });

  it('registration to ward when complete', () => {
    expect(
      canAdvance({
        fromStage: 'registration',
        toStage: 'ward',
        patient: adult,
        admission: baseAdmission,
        items: SEED_ITEMS,
        entries: [],
        transitions: SEED_TRANSITIONS,
      }).can,
    ).toBe(true);
  });

  it('fitness pending cannot move to pre-OT', () => {
    const r = canAdvance({
      fromStage: 'fitness',
      toStage: 'pre_ot',
      patient: adult,
      admission: { ...baseAdmission, current_stage: 'fitness' },
      items: SEED_ITEMS,
      entries: entries({
        'fitness.cardiopul': { status: 'fit' },
        'fitness.tbcd': { status: 'pending' },
        'fitness.cardio': { status: 'fit' },
        'fitness.echo': { status: 'fit' },
      }),
      transitions: SEED_TRANSITIONS,
    });
    expect(r.can).toBe(false);
  });

  it('unfit may move fitness to pre-OT, then return with a reason, incrementing attempt is a caller concern', () => {
    const unfitEntries = entries({
      'fitness.cardiopul': { status: 'fit' },
      'fitness.tbcd': { status: 'unfit' },
      'fitness.cardio': { status: 'fit' },
      'fitness.echo': { status: 'fit' },
      'blood.report': { cleared: 'fine' },
    });
    expect(
      canAdvance({
        fromStage: 'fitness',
        toStage: 'pre_ot',
        patient: adult,
        admission: { ...baseAdmission, current_stage: 'fitness' },
        items: SEED_ITEMS,
        entries: unfitEntries,
        transitions: SEED_TRANSITIONS,
      }).can,
    ).toBe(true);
    expect(
      canAdvance({
        fromStage: 'pre_ot',
        toStage: 'fitness',
        patient: adult,
        admission: { ...baseAdmission, current_stage: 'pre_ot' },
        items: SEED_ITEMS,
        entries: unfitEntries,
        transitions: SEED_TRANSITIONS,
      }).can,
    ).toBe(false);
    expect(
      canAdvance({
        fromStage: 'pre_ot',
        toStage: 'fitness',
        patient: adult,
        admission: { ...baseAdmission, current_stage: 'pre_ot' },
        items: SEED_ITEMS,
        entries: unfitEntries,
        transitions: SEED_TRANSITIONS,
        reason: 'echo pending cardiology review',
      }).can,
    ).toBe(true);
  });

  it('pre-OT to post-op needs labs fine, all fit, Ayushman items, surgery date', () => {
    const ready = entries({
      'fitness.cardiopul': { status: 'fit' },
      'fitness.tbcd': { status: 'fit' },
      'fitness.cardio': { status: 'fit' },
      'fitness.echo': { status: 'fit' },
      'blood.report': { cleared: 'fine' },
      'ayushman.indent': { done: true, reference: 'I-1' },
      'ayushman.os': { done: true, reference: 'OS-1' },
      'ayushman.cms': { done: true, reference: 'CMS-1' },
      'ayushman.shop': { done: true, reference: 'S-1' },
    });
    expect(
      canAdvance({
        fromStage: 'pre_ot',
        toStage: 'post_op',
        patient: adult,
        admission: { ...baseAdmission, current_stage: 'pre_ot' },
        items: SEED_ITEMS,
        entries: ready,
        transitions: SEED_TRANSITIONS,
      }).reason,
    ).toMatch(/Surgery date/);
    expect(
      canAdvance({
        fromStage: 'pre_ot',
        toStage: 'post_op',
        patient: adult,
        admission: { ...baseAdmission, current_stage: 'pre_ot', surgery_date: '2026-11-10' },
        items: SEED_ITEMS,
        entries: ready,
        transitions: SEED_TRANSITIONS,
      }).can,
    ).toBe(true);
  });

  it('admin override needs a reason; resident cannot override', () => {
    expect(
      canAdvance({
        fromStage: 'ward',
        toStage: 'fitness',
        patient: adult,
        admission: { ...baseAdmission, wound_type: null },
        items: SEED_ITEMS,
        entries: [],
        transitions: SEED_TRANSITIONS,
        override: true,
        role: 'resident',
        reason: 'skip',
      }).can,
    ).toBe(false);
    expect(
      canAdvance({
        fromStage: 'ward',
        toStage: 'fitness',
        patient: adult,
        admission: { ...baseAdmission, wound_type: null },
        items: SEED_ITEMS,
        entries: [],
        transitions: SEED_TRANSITIONS,
        override: true,
        role: 'admin',
        reason: 'consultant instruction',
      }).can,
    ).toBe(true);
  });

  it('later unfit after post-op does not silently reverse', () => {
    const postOpEntries = entries({
      'fitness.cardiopul': { status: 'unfit' },
      'fitness.tbcd': { status: 'fit' },
      'fitness.cardio': { status: 'fit' },
      'fitness.echo': { status: 'fit' },
      'blood.report': { cleared: 'fine' },
    });
    expect(
      gateStillHolds({
        currentStage: 'post_op',
        patient: adult,
        admission: { ...baseAdmission, current_stage: 'post_op' },
        items: SEED_ITEMS,
        entries: postOpEntries,
        transitions: SEED_TRANSITIONS,
      }),
    ).toBe(false);
  });
});

describe('client version', () => {
  it('blocks writes when min_client_version is newer', () => {
    expect(isClientAllowed('1.0.0', '1.0.0')).toBe(true);
    expect(isClientAllowed('1.1.0', '1.0.0')).toBe(false);
    expect(isClientAllowed('1.0.0', '1.2.0')).toBe(true);
  });

  it('ignores unknown columns on an old client', () => {
    const { known, ignored } = compareClientColumns(
      { id: '1', extra_future: true, name: 'x' },
      ['id', 'name'],
    );
    expect(known).toEqual({ id: '1', name: 'x' });
    expect(ignored).toEqual(['extra_future']);
  });
});
