import type { ChecklistItem, Condition, Stage, WorkflowTransition } from './types';

const eq = (path: string, value: unknown): Condition => ({ op: 'eq', path, value });
const gt = (path: string, value: unknown): Condition => ({ op: 'gt', path, value });
const gte = (path: string, value: unknown): Condition => ({ op: 'gte', path, value });
const lt = (path: string, value: unknown): Condition => ({ op: 'lt', path, value });
const contains = (path: string, value: unknown): Condition => ({ op: 'contains', path, value });
const inOp = (path: string, value: unknown[]): Condition => ({ op: 'in', path, value });
const and = (...args: Condition[]): Condition => ({ op: 'and', args });
const or = (...args: Condition[]): Condition => ({ op: 'or', args });
const not = (arg: Condition): Condition => ({ op: 'not', arg });

function item(
  stage: Stage,
  item_key: string,
  label: string,
  field_type: ChecklistItem['field_type'],
  extra: Partial<ChecklistItem> = {},
): ChecklistItem {
  return {
    stage,
    item_key,
    label,
    field_type,
    required: extra.required ?? true,
    applies_when: extra.applies_when ?? null,
    options: extra.options,
    active: true,
    sort_order: extra.sort_order ?? 0,
  };
}

export const SEED_ITEMS: ChecklistItem[] = [
  item('ward', 'dressing.daily', 'Daily dressing done', 'bool', {
    sort_order: 10,
    applies_when: eq('admission.wound_type', 'compound'),
  }),
  item('ward', 'wound.note', 'Wound information', 'text', {
    sort_order: 20,
    applies_when: eq('admission.wound_type', 'non_compound'),
  }),
  item('ward', 'wound.photos', 'Wound photos', 'photo', {
    sort_order: 30,
    required: false,
    applies_when: eq('admission.wound_type', 'non_compound'),
  }),
  item('ward', 'blood.report', 'Blood investigations', 'note_photo', { sort_order: 40 }),
  item('ward', 'procedure.plan', 'Planned procedure', 'multi_enum', {
    sort_order: 50,
    options: { choices: ['bipolar', 'THR', 'TCR', 'other', 'undecided'] },
  }),
  item('fitness', 'fitness.pedio', 'Pediatric (Pedio) clearance', 'enum', {
    sort_order: 10,
    applies_when: lt('patient.age', 18),
    options: { choices: ['fit', 'unfit', 'pending'] },
  }),
  item('fitness', 'fitness.cardiopul', 'Cardiopulmonary assessment', 'enum', {
    sort_order: 20,
    applies_when: gte('patient.age', 18),
    options: { choices: ['fit', 'unfit', 'pending'] },
  }),
  item('fitness', 'fitness.tbcd', 'TBCD clearance', 'enum', {
    sort_order: 30,
    applies_when: gt('patient.age', 30),
    options: { choices: ['fit', 'unfit', 'pending'] },
  }),
  item('fitness', 'fitness.cardio', 'Cardiology referral', 'enum', {
    sort_order: 40,
    applies_when: gt('patient.age', 55),
    options: { choices: ['fit', 'unfit', 'pending'] },
  }),
  item('fitness', 'fitness.echo', '2D echo', 'enum', {
    sort_order: 50,
    applies_when: or(
      gt('patient.age', 60),
      contains('admission.planned_procedures', 'THR'),
      contains('admission.planned_procedures', 'bipolar'),
      contains('admission.planned_procedures', 'TCR'),
    ),
    options: { choices: ['fit', 'unfit', 'pending'] },
  }),
  item('pre_ot', 'ayushman.indent', 'Indent', 'note_photo', {
    sort_order: 10,
    applies_when: eq('admission.ayushman_status', 'applied'),
  }),
  item('pre_ot', 'ayushman.os', 'OS', 'note_photo', {
    sort_order: 20,
    applies_when: eq('admission.ayushman_status', 'applied'),
  }),
  item('pre_ot', 'ayushman.cms', 'CMS', 'note_photo', {
    sort_order: 30,
    applies_when: eq('admission.ayushman_status', 'applied'),
  }),
  item('pre_ot', 'ayushman.shop', 'Shop', 'note_photo', {
    sort_order: 40,
    applies_when: eq('admission.ayushman_status', 'applied'),
  }),
  item('pre_ot', 'billing.bill', 'Bill', 'note_photo', {
    sort_order: 10,
    applies_when: inOp('admission.ayushman_status', ['none', 'not_applied']),
  }),
  item('pre_ot', 'billing.supplies', 'Surgical supplies', 'note_photo', {
    sort_order: 20,
    applies_when: inOp('admission.ayushman_status', ['none', 'not_applied']),
  }),
  item('post_op', 'postop.xray', 'Post-op X-ray', 'photo', { sort_order: 10 }),
  item('post_op', 'dressing.day2', 'Day 2 dressing', 'bool', { sort_order: 20 }),
  item('post_op', 'dressing.day4', 'Day 4 dressing', 'bool', { sort_order: 30 }),
  item('post_op', 'ayushman.close', 'Close Ayushman process', 'note_photo', {
    sort_order: 40,
    applies_when: eq('admission.ayushman_status', 'applied'),
  }),
  item('discharge', 'discharge.photocopy', 'Photocopy of discharge copy', 'photo', {
    sort_order: 10,
    applies_when: eq('admission.is_mlc', true),
  }),
  item('discharge', 'discharge.xray_copy', 'X-ray copy provided', 'bool', { sort_order: 20 }),
];

export const SEED_TRANSITIONS: WorkflowTransition[] = [
  {
    from_stage: 'registration',
    to_stage: 'ward',
    guard: null,
    requires_reason: false,
    label: 'Admit to ward',
  },
  {
    from_stage: 'ward',
    to_stage: 'fitness',
    guard: null,
    requires_reason: false,
    label: 'Move to fitness',
  },
  {
    from_stage: 'fitness',
    to_stage: 'pre_ot',
    guard: not(eq('entries.__fitness_any__', 'pending')),
    requires_reason: false,
    label: 'Move to pre-OT',
  },
  {
    from_stage: 'pre_ot',
    to_stage: 'fitness',
    guard: eq('entries.__fitness_any__', 'unfit'),
    requires_reason: true,
    label: 'Return to fitness',
  },
  {
    from_stage: 'pre_ot',
    to_stage: 'post_op',
    guard: and(
      eq('entries.blood.cleared', 'fine'),
      not(eq('entries.__fitness_any__', 'unfit')),
      not(eq('entries.__fitness_any__', 'pending')),
    ),
    requires_reason: false,
    label: 'Move to OT / post-op',
  },
  {
    from_stage: 'post_op',
    to_stage: 'discharge',
    guard: null,
    requires_reason: false,
    label: 'Move to discharge',
  },
  {
    from_stage: 'discharge',
    to_stage: 'discharge',
    guard: null,
    requires_reason: false,
    label: 'Complete discharge',
    completes_admission: true,
  },
];
