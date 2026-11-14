import { useSyncExternalStore } from 'react';
import { needsAttention } from '@ward9/domain';
import { getState, subscribe } from './memoryStore';
import type { AdmissionRow, PatientRow } from './types';

export function useDb() {
  return useSyncExternalStore(subscribe, getState, getState);
}

export type PatientListItem = {
  admission: AdmissionRow;
  patient: PatientRow;
  flags: ReturnType<typeof needsAttention>;
};

export function usePatientList(query: string): PatientListItem[] {
  const db = useDb();
  const q = query.trim().toLowerCase();
  return db.admissions
    .filter((a) => a.status === 'active')
    .map((admission) => {
      const patient = db.patients.find((p) => p.id === admission.patient_id);
      if (!patient) return null;
      const flags = needsAttention({
        patient,
        admission,
        items: db.items,
        entries: db.entries.filter((e) => e.admission_id === admission.id),
        transitions: db.transitions,
        attachments: db.attachments.filter((a) => a.admission_id === admission.id),
      });
      return { admission, patient, flags };
    })
    .filter((row): row is PatientListItem => {
      if (!row) return false;
      if (!q) return true;
      return row.patient.name.toLowerCase().includes(q) || (row.patient.mobile ?? '').includes(q);
    });
}

export function useAdmissionBundle(admissionId: string) {
  const db = useDb();
  const admission = db.admissions.find((a) => a.id === admissionId);
  const patient = db.patients.find((p) => p.id === admission?.patient_id);
  const entries = db.entries.filter((e) => e.admission_id === admissionId);
  const attachments = db.attachments.filter((a) => a.admission_id === admissionId);
  const team = db.team.filter((t) => t.admission_id === admissionId);
  return { db, admission, patient, entries, attachments, team, items: db.items, transitions: db.transitions };
}
