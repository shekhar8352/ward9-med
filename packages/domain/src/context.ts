import type {
  AdmissionFields,
  ChecklistEntry,
  ChecklistItem,
  EvalContext,
  PatientFields,
} from './types';
import { evaluate } from './evaluate';

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}

function fitnessStatus(entries: ChecklistEntry[], items: ChecklistItem[], ctxWithoutFitness: EvalContext): string | null {
  const applicable: string[] = [];
  for (const item of items) {
    if (!item.item_key.startsWith('fitness.')) continue;
    if (item.active === false) continue;
    const applies = evaluate(item.applies_when, ctxWithoutFitness);
    if (!applies.ok) continue;
    if (!applies.value) continue;
    const entry = entries.find((e) => e.item_key === item.item_key);
    const rec = asRecord(entry?.value);
    const status = typeof rec.status === 'string' ? rec.status : typeof rec.value === 'string' ? rec.value : null;
    applicable.push(status ?? 'pending');
  }
  if (applicable.length === 0) return null;
  if (applicable.some((s) => s === 'pending' || s === null)) return 'pending';
  if (applicable.some((s) => s === 'unfit')) return 'unfit';
  if (applicable.every((s) => s === 'fit')) return 'fit';
  return 'pending';
}

export function todayIso(date: Date = new Date(), timeZone = 'Asia/Kolkata'): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(date);
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function dateGte(a: string, b: string): boolean {
  return a >= b;
}

export function buildContext(input: {
  patient: PatientFields;
  admission: AdmissionFields;
  entries: ChecklistEntry[];
  items?: ChecklistItem[];
  today?: string;
}): EvalContext {
  const today = input.today ?? todayIso();
  const entriesMap: Record<string, unknown> = {};
  for (const entry of input.entries) {
    const rec = asRecord(entry.value);
    entriesMap[entry.item_key] = rec;
    for (const [k, v] of Object.entries(rec)) {
      entriesMap[`${entry.item_key}.${k}`] = v;
    }
    if (entry.item_key === 'blood.report') {
      entriesMap['blood.cleared'] = rec.cleared ?? rec.status ?? null;
    }
  }
  const ctx: EvalContext = {
    patient: {
      name: input.patient.name ?? null,
      age: input.patient.age ?? null,
      sex: input.patient.sex ?? null,
    },
    admission: {
      is_mlc: input.admission.is_mlc ?? null,
      ayushman_status: input.admission.ayushman_status ?? null,
      wound_type: input.admission.wound_type ?? null,
      planned_procedures: input.admission.planned_procedures ?? [],
      current_stage: input.admission.current_stage ?? null,
      surgery_date: input.admission.surgery_date ?? null,
      status: input.admission.status ?? 'active',
    },
    entries: entriesMap,
    today,
  };
  ctx.entries.__fitness_any__ = fitnessStatus(input.entries, input.items ?? [], ctx);
  return ctx;
}
