import { supabase, supabaseConfigured } from './supabase';

export async function requestDischargePdf(admissionId: string): Promise<{ signedUrl: string | null; path?: string }> {
  if (!supabaseConfigured || !supabase) {
    return { signedUrl: null };
  }
  const { data, error } = await supabase.functions.invoke('discharge-pdf', {
    body: { admission_id: admissionId },
  });
  if (error) throw error;
  return data as { signedUrl: string | null; path?: string };
}
