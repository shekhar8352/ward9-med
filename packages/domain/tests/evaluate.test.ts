import fixtures from '../fixtures/rules.json';
import { evaluate } from '../src/evaluate';
import type { Condition, EvalContext } from '../src/types';

describe('evaluate', () => {
  for (const row of fixtures.evaluate) {
    it(row.name, () => {
      const result = evaluate(row.cond as Condition | null, row.ctx as EvalContext);
      if ('throws' in row && row.throws) {
        expect(result.ok).toBe(false);
      } else {
        expect(result).toEqual({ ok: true, value: row.expected });
      }
    });
  }

  it('and / or / not', () => {
    const ctx: EvalContext = {
      patient: { age: 62 },
      admission: { wound_type: 'compound' },
      entries: {},
      today: '2026-11-11',
    };
    expect(
      evaluate(
        {
          op: 'and',
          args: [
            { op: 'gt', path: 'patient.age', value: 60 },
            { op: 'eq', path: 'admission.wound_type', value: 'compound' },
          ],
        },
        ctx,
      ),
    ).toEqual({ ok: true, value: true });
    expect(
      evaluate({ op: 'not', arg: { op: 'eq', path: 'admission.wound_type', value: 'compound' } }, ctx),
    ).toEqual({ ok: true, value: false });
  });
});
