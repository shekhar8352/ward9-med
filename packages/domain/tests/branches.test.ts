import { isItemApplicable, isItemComplete } from '../src/completeness';
import { buildContext } from '../src/context';
import { SEED_ITEMS } from '../src/seed';
import type { AdmissionFields, ChecklistEntry, ChecklistItem, PatientFields } from '../src/types';

function applicableKeys(patient: PatientFields, admission: AdmissionFields, extras: ChecklistEntry[] = []) {
  const ctx = buildContext({ patient, admission, entries: extras, items: SEED_ITEMS });
  return SEED_ITEMS.filter((i) => isItemApplicable(i, ctx).can).map((i) => i.item_key);
}

describe('workflow branches', () => {
  it('compound wound asks daily dressing, not wound photos', () => {
    const keys = applicableKeys({ age: 40, sex: 'male' }, { wound_type: 'compound', ayushman_status: 'none' });
    expect(keys).toContain('dressing.daily');
    expect(keys).not.toContain('wound.note');
    expect(keys).not.toContain('wound.photos');
  });

  it('non-compound wound asks note and photos, not daily dressing', () => {
    const keys = applicableKeys({ age: 40 }, { wound_type: 'non_compound' });
    expect(keys).toContain('wound.note');
    expect(keys).toContain('wound.photos');
    expect(keys).not.toContain('dressing.daily');
  });

  it('daily dressing not done still counts as answered', () => {
    const item = SEED_ITEMS.find((i) => i.item_key === 'dressing.daily') as ChecklistItem;
    const ctx = buildContext({
      patient: { age: 40 },
      admission: { wound_type: 'compound' },
      entries: [{ item_key: 'dressing.daily', value: { done: false } }],
      items: SEED_ITEMS,
    });
    expect(isItemComplete(item, { item_key: 'dressing.daily', value: { done: false } }, ctx).can).toBe(true);
  });

  it.each([
    ['applied', ['ayushman.indent', 'ayushman.os', 'ayushman.cms', 'ayushman.shop'], ['billing.bill', 'billing.supplies']],
    ['none', ['billing.bill', 'billing.supplies'], ['ayushman.indent']],
    ['not_applied', ['billing.bill', 'billing.supplies'], ['ayushman.shop']],
  ] as const)('Ayushman %s', (status, yes, no) => {
    const keys = applicableKeys({ age: 40 }, { ayushman_status: status });
    for (const k of yes) expect(keys).toContain(k);
    for (const k of no) expect(keys).not.toContain(k);
  });

  it.each([
    [17, ['fitness.pedio'], ['fitness.cardiopul', 'fitness.tbcd', 'fitness.cardio', 'fitness.echo']],
    [18, ['fitness.cardiopul'], ['fitness.pedio', 'fitness.tbcd']],
    [30, ['fitness.cardiopul'], ['fitness.tbcd', 'fitness.pedio']],
    [31, ['fitness.cardiopul', 'fitness.tbcd'], ['fitness.cardio', 'fitness.pedio']],
    [55, ['fitness.cardiopul', 'fitness.tbcd'], ['fitness.cardio']],
    [56, ['fitness.cardiopul', 'fitness.tbcd', 'fitness.cardio'], ['fitness.echo']],
    [60, ['fitness.cardiopul', 'fitness.tbcd', 'fitness.cardio'], ['fitness.echo']],
    [61, ['fitness.cardiopul', 'fitness.tbcd', 'fitness.cardio', 'fitness.echo'], ['fitness.pedio']],
  ] as const)('fitness age %s', (age, yes, no) => {
    const keys = applicableKeys({ age }, { planned_procedures: [] });
    for (const k of yes) expect(keys).toContain(k);
    for (const k of no) expect(keys).not.toContain(k);
  });

  it('2D echo via THR at age 45', () => {
    const keys = applicableKeys({ age: 45 }, { planned_procedures: ['THR'] });
    expect(keys).toContain('fitness.echo');
  });

  it('2D echo via bipolar or TCR', () => {
    expect(applicableKeys({ age: 40 }, { planned_procedures: ['bipolar'] })).toContain('fitness.echo');
    expect(applicableKeys({ age: 40 }, { planned_procedures: ['TCR'] })).toContain('fitness.echo');
  });

  it('age 70 THR gets cardiopul, tbcd, cardio, echo', () => {
    const keys = applicableKeys({ age: 70 }, { planned_procedures: ['THR'] });
    expect(keys).toEqual(expect.arrayContaining([
      'fitness.cardiopul',
      'fitness.tbcd',
      'fitness.cardio',
      'fitness.echo',
    ]));
    expect(keys).not.toContain('fitness.pedio');
  });

  it('MLC asks photocopy; non-MLC does not', () => {
    expect(applicableKeys({ age: 40 }, { is_mlc: true })).toContain('discharge.photocopy');
    expect(applicableKeys({ age: 40 }, { is_mlc: false })).not.toContain('discharge.photocopy');
    expect(applicableKeys({ age: 40 }, { is_mlc: false })).toContain('discharge.xray_copy');
  });

  it('day 1 early discharge does not require day 2 dressing', () => {
    const item = SEED_ITEMS.find((i) => i.item_key === 'dressing.day2') as ChecklistItem;
    const ctx = buildContext({
      patient: { age: 40 },
      admission: { surgery_date: '2026-11-11' },
      entries: [],
      items: SEED_ITEMS,
      today: '2026-11-11',
    });
    expect(isItemComplete(item, undefined, ctx).can).toBe(true);
  });

  it('day 3 with day 2 still open is incomplete', () => {
    const item = SEED_ITEMS.find((i) => i.item_key === 'dressing.day2') as ChecklistItem;
    const ctx = buildContext({
      patient: { age: 40 },
      admission: { surgery_date: '2026-11-08' },
      entries: [],
      items: SEED_ITEMS,
      today: '2026-11-11',
    });
    expect(isItemComplete(item, undefined, ctx).can).toBe(false);
  });

  it('waived with empty reason fails; waived with reason passes', () => {
    const item = SEED_ITEMS.find((i) => i.item_key === 'dressing.day2') as ChecklistItem;
    const ctx = buildContext({
      patient: { age: 40 },
      admission: { surgery_date: '2026-11-01' },
      entries: [],
      items: SEED_ITEMS,
      today: '2026-11-11',
    });
    expect(isItemComplete(item, { item_key: 'dressing.day2', value: { waived: true } }, ctx).can).toBe(false);
    expect(
      isItemComplete(item, { item_key: 'dressing.day2', value: { waived: true, reason: 'early discharge' } }, ctx).can,
    ).toBe(true);
  });
});
