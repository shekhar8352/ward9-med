import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Minimal one-page PDF. Not a medico-legal discharge summary.
 * Helvetica-only, 12pt, wrapped lines.
 */
function pdfEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildPdf(lines: string[]): Uint8Array {
  const pageWidth = 595;
  const pageHeight = 842;
  let y = 800;
  const content: string[] = ['BT', '/F1 12 Tf'];
  for (const line of lines) {
    if (y < 50) break;
    content.push(`1 0 0 1 50 ${y} Tm (${pdfEscape(line.slice(0, 90))}) Tj`);
    y -= 16;
  }
  content.push('ET');
  const stream = content.join('\n');
  const objects: string[] = [];
  objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj');
  objects.push('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj');
  objects.push(
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj`,
  );
  objects.push(`4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`);
  objects.push('5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj');
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj + '\n';
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return encoder.encode(pdf);
}

const encoder = new TextEncoder();

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const admissionId = body.admission_id as string;
  if (!admissionId) {
    return Response.json({ error: 'admission_id required' }, { status: 400 });
  }

  const { data: admission, error } = await supabase
    .schema('app')
    .from('admissions')
    .select('*, patients(*)')
    .eq('id', admissionId)
    .maybeSingle();
  if (error || !admission) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  const { data: entries } = await supabase
    .schema('app')
    .from('checklist_entries')
    .select('item_key, value, done_by, done_at')
    .eq('admission_id', admissionId);

  const patient = (admission as { patients?: { name?: string; age?: number; sex?: string } }).patients;
  const lines = [
    'Ward 9 Orthopaedic — Discharge checklist',
    'This is a working checklist, not a medico-legal discharge summary.',
    '',
    `Patient: ${patient?.name ?? ''}  Age: ${patient?.age ?? ''}  Sex: ${patient?.sex ?? ''}`,
    `MLC: ${admission.is_mlc ? 'Yes' : 'No'}  Ayushman: ${admission.ayushman_status ?? ''}`,
    `Stage: ${admission.current_stage}  Status: ${admission.status}`,
    `Surgery date: ${admission.surgery_date ?? '—'}`,
    '',
    'Recorded items:',
  ];
  for (const e of entries ?? []) {
    lines.push(`- ${e.item_key}: ${JSON.stringify(e.value)}`);
  }
  const bytes = buildPdf(lines);
  const path = `${admission.hospital_id}/${admissionId}/discharge-checklist.pdf`;
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  await admin.storage.from('patient-files').upload(path, bytes, {
    contentType: 'application/pdf',
    upsert: true,
  });
  const { data: signed } = await supabase.storage.from('patient-files').createSignedUrl(path, 60);
  return Response.json({ path, signedUrl: signed?.signedUrl ?? null });
});
