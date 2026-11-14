import { registerPatient, upsertEntry, updateAdmission, advanceStage, getState } from './memoryStore';

/** Fictional patients for the ward walkthrough. Never use these names on a live ward. */
export function seedFictionalPatients() {
  if (getState().admissions.length > 0) return;

  const ravi = registerPatient({
    name: 'Ravi Kumar (demo)',
    age: 62,
    sex: 'male',
    father_name: 'Ram Kumar',
    address: 'Patna',
    mobile: '9000000001',
    brought_by_name: 'Sita Kumar',
    brought_by_relation: 'wife',
    is_mlc: false,
    ayushman_status: 'applied',
    photo_consent: true,
    past_history: 'Hypertension',
  });
  advanceStage({ admissionId: ravi.admission.id, toStage: 'ward' });
  updateAdmission(ravi.admission.id, { wound_type: 'compound', planned_procedures: ['THR'] });
  upsertEntry(ravi.admission.id, 'dressing.daily', { done: true });
  upsertEntry(ravi.admission.id, 'blood.report', { cleared: 'fine', status: 'resulted', note: 'Hb 11.2' });
  upsertEntry(ravi.admission.id, 'procedure.plan', { value: ['THR'] });
  advanceStage({ admissionId: ravi.admission.id, toStage: 'fitness' });

  const anita = registerPatient({
    name: 'Anita Devi (demo)',
    age: 16,
    sex: 'female',
    father_name: 'Mohan',
    address: 'Gaya',
    mobile: '9000000002',
    brought_by_name: 'Mohan',
    brought_by_relation: 'father',
    is_mlc: true,
    ayushman_status: 'none',
    photo_consent: true,
  });
  advanceStage({ admissionId: anita.admission.id, toStage: 'ward' });
  updateAdmission(anita.admission.id, { wound_type: 'non_compound', planned_procedures: ['other'] });
  upsertEntry(anita.admission.id, 'wound.note', { value: 'Closed tibial fracture, no skin break' });
  upsertEntry(anita.admission.id, 'blood.report', { cleared: 'pending', status: 'pending' });
  upsertEntry(anita.admission.id, 'procedure.plan', { value: ['other'] });

  const imran = registerPatient({
    name: 'Imran Ali (demo)',
    age: 45,
    sex: 'male',
    father_name: 'Yusuf Ali',
    address: 'Muzaffarpur',
    brought_by_name: 'Farah',
    brought_by_relation: 'sister',
    brought_by_phone: '9000000003',
    is_mlc: false,
    ayushman_status: 'not_applied',
    photo_consent: false,
  });
  advanceStage({ admissionId: imran.admission.id, toStage: 'ward' });
  updateAdmission(imran.admission.id, { wound_type: 'compound', planned_procedures: ['THR'] });
  upsertEntry(imran.admission.id, 'dressing.daily', { done: false });
  upsertEntry(imran.admission.id, 'blood.report', { cleared: 'fine', status: 'resulted' });
  upsertEntry(imran.admission.id, 'procedure.plan', { value: ['THR'] });
  advanceStage({ admissionId: imran.admission.id, toStage: 'fitness' });
  upsertEntry(imran.admission.id, 'fitness.cardiopul', { status: 'fit' });
  upsertEntry(imran.admission.id, 'fitness.tbcd', { status: 'fit' });
  upsertEntry(imran.admission.id, 'fitness.echo', { status: 'unfit', note: 'Echo pending cardiology' });
}
