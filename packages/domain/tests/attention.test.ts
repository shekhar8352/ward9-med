import { needsAttention } from '../src/attention';
import { SEED_ITEMS, SEED_TRANSITIONS } from '../src/seed';

const patient = { name: 'X', age: 45, sex: 'male' as const, father_name: 'F', address: 'A', mobile: '1' };

describe('needs attention', () => {
  it('flags ayushman not applied, daily dressing not done, fitness pending', () => {
    const flags = needsAttention({
      patient,
      admission: {
        current_stage: 'fitness',
        ayushman_status: 'not_applied',
        wound_type: 'compound',
        planned_procedures: ['THR'],
        photo_consent: true,
        brought_by_name: 'B',
        brought_by_relation: 'sister',
      },
      items: SEED_ITEMS,
      entries: [
        { item_key: 'dressing.daily', value: { done: false } },
        { item_key: 'fitness.cardiopul', value: { status: 'pending' } },
        { item_key: 'fitness.tbcd', value: { status: 'fit' } },
        { item_key: 'fitness.echo', value: { status: 'fit' } },
      ],
      transitions: SEED_TRANSITIONS,
    });
    expect(flags.map((f) => f.kind)).toEqual(
      expect.arrayContaining(['ayushman_not_applied', 'daily_dressing_not_done', 'fitness_pending']),
    );
  });
});
