import { supabase, supabaseConfigured } from './supabase';
import type { AdmissionRow, AttachmentRow, EntryRow, PatientRow, TeamRow } from './types';

/**
 * Upload local mutations when a network is present. PowerSync's CRUD batch
 * would call the same RPCs; this module is the shared write adapter.
 */
export async function uploadPatient(row: PatientRow) {
  if (!supabaseConfigured || !supabase) return;
  await supabase.from('patients').upsert(row);
}

export async function uploadAdmission(row: AdmissionRow) {
  if (!supabaseConfigured || !supabase) return;
  await supabase.from('admissions').upsert(row);
}

export async function uploadTeam(row: TeamRow) {
  if (!supabaseConfigured || !supabase) return;
  await supabase.from('admission_team').upsert(row);
}

export async function uploadEntry(row: EntryRow) {
  if (!supabaseConfigured || !supabase) return;
  const { data, error } = await supabase.rpc('upsert_checklist_entry', {
    p_id: row.id,
    p_hospital_id: row.hospital_id,
    p_admission_id: row.admission_id,
    p_item_key: row.item_key,
    p_value: row.value,
    p_done_by: row.done_by,
    p_done_at: row.done_at,
    p_updated_at: row.updated_at,
    p_device_id: row.device_id,
    p_client_mutation_id: row.client_mutation_id,
  });
  if (error) throw error;
  return data;
}

export async function uploadAttachmentMeta(row: AttachmentRow) {
  if (!supabaseConfigured || !supabase) return;
  await supabase.from('attachments').upsert({
    id: row.id,
    hospital_id: row.hospital_id,
    admission_id: row.admission_id,
    entry_id: row.entry_id,
    kind: row.kind,
    storage_path: row.storage_path,
    byte_size: row.byte_size,
    upload_status: row.upload_status,
    uploaded_by: row.uploaded_by,
  });
}

export async function advanceStageRemote(input: {
  admissionId: string;
  toStage: string;
  reason?: string;
  override?: boolean;
  deviceId: string;
  surgeryDate?: string;
  completes?: boolean;
}) {
  if (!supabaseConfigured || !supabase) return;
  const { error } = await supabase.rpc('advance_stage', {
    p_admission_id: input.admissionId,
    p_to_stage: input.toStage,
    p_reason: input.reason ?? null,
    p_override: input.override ?? false,
    p_device_id: input.deviceId,
    p_surgery_date: input.surgeryDate ?? null,
    p_completes: input.completes ?? false,
  });
  if (error) throw error;
}
