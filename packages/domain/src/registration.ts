import type { AdmissionFields, GateResult, PatientFields } from './types';

function missing(label: string): GateResult {
  return { can: false, reason: `${label} is required` };
}

function hasText(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

export function isRegistrationComplete(
  patient: PatientFields,
  admission: AdmissionFields,
): GateResult {
  if (!hasText(patient.name)) return missing('Name');
  if (patient.age == null || !Number.isFinite(patient.age)) return missing('Age');
  if (patient.age < 0 || patient.age >= 130) return { can: false, reason: 'Age is invalid' };
  if (!patient.sex) return missing('Sex');
  if (!hasText(patient.father_name)) return missing("Father's name");
  if (!hasText(patient.address)) return missing('Address');
  if (!hasText(admission.brought_by_name)) return missing('Brought-by name');
  if (!hasText(admission.brought_by_relation)) return missing('Brought-by relation');
  if (admission.is_mlc !== true && admission.is_mlc !== false) return missing('MLC');
  if (!admission.ayushman_status) return missing('Ayushman status');
  if (admission.photo_consent !== true && admission.photo_consent !== false) {
    return missing('Photo consent');
  }
  const hasPhone = hasText(patient.mobile) || hasText(admission.brought_by_phone);
  if (!hasPhone) return { can: false, reason: 'Patient or brought-by phone is required' };
  if (patient.age < 18) {
    if (!hasText(admission.brought_by_name) || !hasText(admission.brought_by_relation)) {
      return { can: false, reason: 'Guardian name and relation are required under 18' };
    }
  }
  return { can: true, reason: '' };
}

export function possibleDuplicate(
  candidate: { name: string; mobile?: string | null },
  existing: Array<{ name: string; mobile?: string | null }>,
): boolean {
  const name = candidate.name.trim().toLowerCase();
  const mobile = (candidate.mobile ?? '').replace(/\D/g, '');
  return existing.some((p) => {
    const sameName = p.name.trim().toLowerCase() === name;
    const pMobile = (p.mobile ?? '').replace(/\D/g, '');
    const sameMobile = mobile.length >= 8 && pMobile === mobile;
    return sameName || sameMobile;
  });
}
