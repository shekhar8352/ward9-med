import { isItemApplicable, isItemComplete, isDressingRequiredNow } from './completeness';
import { buildContext } from './context';
import { gateStillHolds } from './canAdvance';
import type {
  AdmissionFields,
  ChecklistEntry,
  ChecklistItem,
  PatientFields,
  Stage,
  UploadStatus,
  WorkflowTransition,
} from './types';

export type AttentionKind =
  | 'required_open'
  | 'dressing_due'
  | 'fitness_pending'
  | 'ayushman_not_applied'
  | 'upload_failed'
  | 'gate_broken'
  | 'daily_dressing_not_done';

export type AttentionFlag = {
  kind: AttentionKind;
  label: string;
  item_key?: string;
};

export function needsAttention(input: {
  patient: PatientFields;
  admission: AdmissionFields & { current_stage: Stage; is_mlc?: boolean | null };
  items: ChecklistItem[];
  entries: ChecklistEntry[];
  transitions: WorkflowTransition[];
  attachments?: Array<{ upload_status: UploadStatus }>;
  today?: string;
}): AttentionFlag[] {
  const flags: AttentionFlag[] = [];
  const ctx = buildContext({
    patient: input.patient,
    admission: input.admission,
    entries: input.entries,
    items: input.items,
    today: input.today,
  });
  const stage = input.admission.current_stage;

  for (const item of input.items) {
    if (item.stage !== stage || item.active === false) continue;
    const applies = isItemApplicable(item, ctx);
    if (!applies.can) continue;
    const entry = input.entries.find((e) => e.item_key === item.item_key);
    const complete = isItemComplete(item, entry, ctx);
    if (item.required && !complete.can) {
      flags.push({ kind: 'required_open', label: complete.reason, item_key: item.item_key });
    }
  }

  const daily = input.entries.find((e) => e.item_key === 'dressing.daily');
  if (daily) {
    const rec = (daily.value ?? {}) as Record<string, unknown>;
    if (rec.done === false || rec.value === false) {
      flags.push({
        kind: 'daily_dressing_not_done',
        label: 'Daily dressing not done',
        item_key: 'dressing.daily',
      });
    }
  }

  if (
    isDressingRequiredNow('dressing.day2', input.admission.surgery_date, ctx.today) &&
    !input.entries.some((e) => e.item_key === 'dressing.day2' && (e.value as { done?: boolean })?.done)
  ) {
    flags.push({ kind: 'dressing_due', label: 'Day 2 dressing due', item_key: 'dressing.day2' });
  }
  if (
    isDressingRequiredNow('dressing.day4', input.admission.surgery_date, ctx.today) &&
    !input.entries.some((e) => e.item_key === 'dressing.day4' && (e.value as { done?: boolean })?.done)
  ) {
    flags.push({ kind: 'dressing_due', label: 'Day 4 dressing due', item_key: 'dressing.day4' });
  }

  if (ctx.entries.__fitness_any__ === 'pending') {
    flags.push({ kind: 'fitness_pending', label: 'Fitness still pending' });
  }
  if (input.admission.ayushman_status === 'not_applied') {
    flags.push({ kind: 'ayushman_not_applied', label: 'Ayushman card recorded, not applied' });
  }
  if (input.attachments?.some((a) => a.upload_status === 'failed' || a.upload_status === 'pending')) {
    flags.push({ kind: 'upload_failed', label: 'A photo is still on this phone' });
  }
  if (
    !gateStillHolds({
      currentStage: stage,
      patient: input.patient,
      admission: input.admission,
      items: input.items,
      entries: input.entries,
      transitions: input.transitions,
      today: input.today,
    })
  ) {
    flags.push({ kind: 'gate_broken', label: 'Gate no longer holds' });
  }
  return flags;
}
