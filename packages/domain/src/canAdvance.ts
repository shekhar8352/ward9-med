import { itemGate } from './completeness';
import { buildContext } from './context';
import { evaluate } from './evaluate';
import { isRegistrationComplete } from './registration';
import { STAGES } from './types';
import type {
  AdmissionFields,
  ChecklistEntry,
  ChecklistItem,
  GateResult,
  PatientFields,
  Stage,
  WorkflowTransition,
} from './types';

export function findTransition(
  transitions: WorkflowTransition[],
  from: Stage,
  to: Stage,
  completes?: boolean,
): WorkflowTransition | undefined {
  return transitions.find((t) => {
    if (t.from_stage !== from || t.to_stage !== to) return false;
    if (completes != null) return Boolean(t.completes_admission) === completes;
    return true;
  });
}

export function canAdvance(input: {
  fromStage: Stage;
  toStage: Stage;
  patient: PatientFields;
  admission: AdmissionFields;
  items: ChecklistItem[];
  entries: ChecklistEntry[];
  transitions: WorkflowTransition[];
  reason?: string | null;
  override?: boolean;
  role?: string;
  today?: string;
  completesAdmission?: boolean;
}): GateResult {
  if (input.override) {
    if (input.role !== 'admin') {
      return { can: false, reason: 'Only an admin can override a gate' };
    }
    if (!input.reason || !input.reason.trim()) {
      return { can: false, reason: 'Override needs a reason' };
    }
    const edge = findTransition(
      input.transitions,
      input.fromStage,
      input.toStage,
      input.completesAdmission,
    );
    if (!edge) {
      return { can: false, reason: 'That stage move is not allowed' };
    }
    return { can: true, reason: '' };
  }

  const transition = findTransition(
    input.transitions,
    input.fromStage,
    input.toStage,
    input.completesAdmission,
  );
  if (!transition) {
    return { can: false, reason: 'That stage move is not allowed' };
  }
  if (transition.requires_reason && !input.reason?.trim()) {
    return { can: false, reason: 'A reason is required' };
  }

  if (input.fromStage === 'registration') {
    const reg = isRegistrationComplete(input.patient, input.admission);
    if (!reg.can) return reg;
  } else if (input.fromStage === 'ward' && !input.admission.wound_type) {
    return { can: false, reason: 'Wound type is required' };
  }

  const ctx = buildContext({
    patient: input.patient,
    admission: input.admission,
    entries: input.entries,
    items: input.items,
    today: input.today,
  });

  const fromIdx = STAGES.indexOf(input.fromStage);
  const toIdx = STAGES.indexOf(input.toStage);
  const movingForward = input.completesAdmission || toIdx > fromIdx;
  if (input.fromStage !== 'registration' && movingForward) {
    const gate = itemGate(input.fromStage, input.items, input.entries, ctx);
    if (!gate.can) return gate;
  }

  if (input.toStage === 'post_op' && !input.admission.surgery_date) {
    return { can: false, reason: 'Surgery date is required to move to OT' };
  }

  const guard = evaluate(transition.guard, ctx);
  if (!guard.ok) {
    return { can: false, reason: 'Rule error on this transition', ruleError: guard.error };
  }
  if (!guard.value) {
    return { can: false, reason: `${transition.label} is blocked` };
  }
  return { can: true, reason: '' };
}

export function gateStillHolds(input: {
  currentStage: Stage;
  patient: PatientFields;
  admission: AdmissionFields;
  items: ChecklistItem[];
  entries: ChecklistEntry[];
  transitions: WorkflowTransition[];
  today?: string;
}): boolean {
  const incoming = input.transitions.filter((t) => t.to_stage === input.currentStage && !t.completes_admission);
  if (incoming.length === 0) return true;
  // If any required item of the previous stage would now fail, flag needs-attention.
  // We check the item gate of the current stage (open required work) plus the last incoming guard.
  const ctx = buildContext({
    patient: input.patient,
    admission: input.admission,
    entries: input.entries,
    items: input.items,
    today: input.today,
  });
  const currentGate = itemGate(input.currentStage, input.items, input.entries, ctx);
  if (currentGate.ruleError) return true;
  // Broken gate: currently in post_op/discharge but fitness now unfit or blood not fine
  if (input.currentStage === 'post_op' || input.currentStage === 'discharge') {
    const fitness = ctx.entries.__fitness_any__;
    const blood = ctx.entries['blood.cleared'];
    if (fitness === 'unfit' || fitness === 'pending' || (blood != null && blood !== 'fine')) {
      return false;
    }
  }
  return true;
}
