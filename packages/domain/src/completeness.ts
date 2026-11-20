import { addDays, dateGte } from './context';
import { evaluate } from './evaluate';
import { KNOWN_FIELD_TYPES, type ChecklistEntry, type ChecklistItem, type EvalContext, type GateResult } from './types';

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (value === undefined || value === null) return {};
  return { value };
}

function hasText(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

function isAnsweredBool(v: unknown): boolean {
  return v === true || v === false;
}

function hasPhoto(rec: Record<string, unknown>): boolean {
  if (hasText(rec.attachment_id) || hasText(rec.photo_id)) return true;
  if (Array.isArray(rec.attachment_ids) && rec.attachment_ids.length > 0) return true;
  if (rec.not_taken === true) return true;
  return false;
}

export function isFieldTypeKnown(fieldType: string): boolean {
  return (KNOWN_FIELD_TYPES as string[]).includes(fieldType);
}

export function isItemApplicable(item: ChecklistItem, ctx: EvalContext): GateResult {
  if (item.active === false) {
    return { can: false, reason: 'inactive' };
  }
  const result = evaluate(item.applies_when, ctx);
  if (!result.ok) {
    return { can: false, reason: 'rule error', ruleError: result.error };
  }
  return result.value
    ? { can: true, reason: '' }
    : { can: false, reason: 'does not apply' };
}

function dressingDueComplete(
  rec: Record<string, unknown>,
  surgeryDate: string | null | undefined,
  offsetDays: number,
  today: string,
): GateResult {
  if (rec.done === true || rec.value === true) {
    return { can: true, reason: '' };
  }
  if (rec.waived === true) {
    if (!hasText(rec.reason) && !hasText(rec.waive_reason)) {
      return { can: false, reason: 'waiver needs a reason' };
    }
    return { can: true, reason: '' };
  }
  if (!surgeryDate) {
    return { can: true, reason: '' };
  }
  const dueOn = addDays(surgeryDate, offsetDays);
  if (!dateGte(today, dueOn)) {
    return { can: true, reason: '' };
  }
  return { can: false, reason: `Day ${offsetDays} dressing is due` };
}

export function isItemComplete(
  item: ChecklistItem,
  entry: ChecklistEntry | undefined,
  ctx: EvalContext,
): GateResult {
  if (!isFieldTypeKnown(item.field_type)) {
    return { can: false, reason: 'Update the app to complete this item' };
  }
  const rec = asRecord(entry?.value);
  const surgeryDate =
    typeof ctx.admission.surgery_date === 'string' ? ctx.admission.surgery_date : null;
  const today = String(ctx.today);

  if (item.item_key === 'dressing.day2') {
    return dressingDueComplete(rec, surgeryDate, 2, today);
  }
  if (item.item_key === 'dressing.day4') {
    return dressingDueComplete(rec, surgeryDate, 4, today);
  }

  if (item.item_key === 'blood.report') {
    const cleared = rec.cleared;
    if (cleared === 'fine' || cleared === 'not_fine') {
      return { can: true, reason: '' };
    }
    return { can: false, reason: 'Blood report not marked fine or not fine' };
  }

  if (item.item_key.startsWith('fitness.')) {
    const status = rec.status ?? rec.value;
    if (status === 'fit' || status === 'unfit' || status === 'pending') {
      return { can: true, reason: '' };
    }
    return { can: false, reason: `${item.label} not recorded` };
  }

  if (item.item_key === 'dressing.daily') {
    if (isAnsweredBool(rec.done) || isAnsweredBool(rec.value)) {
      return { can: true, reason: '' };
    }
    return { can: false, reason: 'Daily dressing not answered' };
  }

  switch (item.field_type) {
    case 'bool':
      return isAnsweredBool(rec.value) || isAnsweredBool(rec.done)
        ? { can: true, reason: '' }
        : { can: false, reason: `${item.label} not answered` };
    case 'text':
      return hasText(rec.value) || hasText(rec.text)
        ? { can: true, reason: '' }
        : { can: false, reason: `${item.label} is empty` };
    case 'number':
      return typeof rec.value === 'number' || (hasText(rec.value) && Number.isFinite(Number(rec.value)))
        ? { can: true, reason: '' }
        : { can: false, reason: `${item.label} needs a number` };
    case 'enum':
      return hasText(rec.value)
        ? { can: true, reason: '' }
        : { can: false, reason: `${item.label} not selected` };
    case 'multi_enum': {
      const arr = Array.isArray(rec.value) ? rec.value : rec.values;
      return Array.isArray(arr) && arr.length > 0
        ? { can: true, reason: '' }
        : { can: false, reason: `${item.label} not selected` };
    }
    case 'date':
      return hasText(rec.value)
        ? { can: true, reason: '' }
        : { can: false, reason: `${item.label} needs a date` };
    case 'photo':
      return hasPhoto(rec)
        ? { can: true, reason: '' }
        : { can: false, reason: `${item.label} needs a photo` };
    case 'note_photo': {
      const done = rec.done === true || rec.value === true;
      if (!done) return { can: false, reason: `${item.label} not done` };
      if (!hasText(rec.note) && !hasText(rec.reference) && !hasPhoto(rec)) {
        // done flag plus any of note / reference / photo is enough; done alone is allowed
        return { can: true, reason: '' };
      }
      return { can: true, reason: '' };
    }
    default:
      return { can: false, reason: 'Update the app to complete this item' };
  }
}

export function isDressingRequiredNow(
  itemKey: 'dressing.day2' | 'dressing.day4',
  surgeryDate: string | null | undefined,
  today: string,
): boolean {
  if (!surgeryDate) return false;
  const offset = itemKey === 'dressing.day2' ? 2 : 4;
  return dateGte(today, addDays(surgeryDate, offset));
}

export function itemGate(
  stage: string,
  items: ChecklistItem[],
  entries: ChecklistEntry[],
  ctx: EvalContext,
): GateResult {
  const stageItems = items.filter((i) => i.stage === stage && i.active !== false);
  for (const item of stageItems) {
    const applies = isItemApplicable(item, ctx);
    if (applies.ruleError) {
      return {
        can: false,
        reason: `Rule error on ${item.label}`,
        ruleError: applies.ruleError,
      };
    }
    if (!applies.can) continue;
    if (!item.required) continue;
    const entry = entries.find((e) => e.item_key === item.item_key);
    const complete = isItemComplete(item, entry, ctx);
    if (!complete.can) return complete;
  }
  return { can: true, reason: '' };
}
