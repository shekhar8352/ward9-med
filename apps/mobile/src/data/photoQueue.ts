import { addAttachment, getCurrentUserId, getState, updateAttachment } from './memoryStore';
import { supabase, supabaseConfigured } from './supabase';
import { newId } from '../ids';

type Job = { attachmentId: string; localUri: string; path: string; attempt: number };

const queue: Job[] = [];
let running = false;

async function compress(uri: string): Promise<{ uri: string; size: number }> {
  try {
    const ImageManipulator = await import('expo-image-manipulator');
    const result = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return { uri: result.uri, size: result.height * result.width };
  } catch {
    return { uri, size: 0 };
  }
}

export async function enqueuePhoto(input: {
  admissionId: string;
  entryId?: string | null;
  kind: string;
  localUri: string;
}) {
  const compressed = await compress(input.localUri);
  const id = newId();
  const hospitalId = getState().hospital.id;
  const path = `${hospitalId}/${input.admissionId}/${id}.jpg`;
  addAttachment({
    id,
    admission_id: input.admissionId,
    entry_id: input.entryId ?? null,
    kind: input.kind,
    local_uri: compressed.uri,
    storage_path: null,
    byte_size: compressed.size,
    upload_status: 'pending',
    uploaded_by: getCurrentUserId(),
  });
  queue.push({ attachmentId: id, localUri: compressed.uri, path, attempt: 0 });
  void pump();
  return id;
}

async function pump() {
  if (running) return;
  running = true;
  try {
    let inflight = 0;
    while (queue.length && inflight < 2) {
      const job = queue.shift();
      if (!job) break;
      inflight++;
      try {
        updateAttachment(job.attachmentId, { upload_status: 'uploading' });
        if (supabaseConfigured && supabase) {
          const res = await fetch(job.localUri);
          const blob = await res.blob();
          const { error } = await supabase.storage.from('patient-files').upload(job.path, blob, {
            contentType: 'image/jpeg',
            upsert: true,
          });
          if (error) throw error;
          updateAttachment(job.attachmentId, { upload_status: 'uploaded', storage_path: job.path });
        } else {
          // Demo: treat as uploaded locally so the walkthrough can complete.
          updateAttachment(job.attachmentId, { upload_status: 'uploaded', storage_path: job.path });
        }
      } catch {
        const next = job.attempt + 1;
        updateAttachment(job.attachmentId, { upload_status: next > 6 ? 'failed' : 'pending' });
        if (next <= 6) {
          const delay = Math.min(60_000, 1000 * 2 ** next);
          setTimeout(() => {
            queue.push({ ...job, attempt: next });
            void pump();
          }, delay);
        }
      } finally {
        inflight--;
      }
    }
  } finally {
    running = false;
    if (queue.length) void pump();
  }
}

export function pendingPhotoCount() {
  return getState().attachments.filter((a) => a.upload_status === 'pending' || a.upload_status === 'failed').length;
}

export function startPhotoQueueOnReconnect() {
  for (const a of getState().attachments) {
    if ((a.upload_status === 'pending' || a.upload_status === 'failed') && a.local_uri) {
      const hospitalId = getState().hospital.id;
      queue.push({
        attachmentId: a.id,
        localUri: a.local_uri,
        path: a.storage_path ?? `${hospitalId}/${a.admission_id}/${a.id}.jpg`,
        attempt: 0,
      });
    }
  }
  void pump();
}
