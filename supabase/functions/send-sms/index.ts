import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const encoder = new TextEncoder();

function b64decode(s: string): Uint8Array {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function verifyStandardWebhook(body: Uint8Array, headers: Headers, secret: string): Promise<boolean> {
  const keyRaw = secret.replace(/^v1,whsec_/, '');
  const key = b64decode(keyRaw);
  const id = headers.get('webhook-id') ?? '';
  const ts = headers.get('webhook-timestamp') ?? '';
  const signatureHeader = headers.get('webhook-signature') ?? '';
  if (!id || !ts || !signatureHeader) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const prefix = encoder.encode(`${id}.${ts}.`);
  const payload = new Uint8Array(prefix.length + body.length);
  payload.set(prefix, 0);
  payload.set(body, prefix.length);
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, payload);
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return signatureHeader.split(' ').some((part) => {
    const hex = part.includes(',') ? part.split(',')[1] : part;
    return hex === expected;
  });
}

function digits(phone: string): string {
  return phone.replace(/\D/g, '');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }
  const secret = Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '';
  const body = new Uint8Array(await req.arrayBuffer());
  const ok = await verifyStandardWebhook(body, req.headers, secret);
  if (!ok) {
    return Response.json({ error: { http_code: 401, message: 'invalid' } }, { status: 401 });
  }
  const event = JSON.parse(new TextDecoder().decode(body));
  const phone: string = event.user?.phone ?? '';
  const otp: string = event.sms?.otp ?? '';
  if (!phone || !otp) {
    return Response.json({ error: { http_code: 400, message: 'missing' } }, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const d = digits(phone);
  const { data: allowed } = await supabase.rpc('otp_phone_allowed', { p_phone: d });
  if (!allowed) {
    // Invite-only: do not send an OTP to unknown numbers.
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const authKey = Deno.env.get('MSG91_AUTH_KEY') ?? '';
  const templateId = Deno.env.get('MSG91_OTP_TEMPLATE_ID') ?? '';
  if (authKey && templateId) {
    const res = await fetch('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: { authkey: authKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: templateId, mobile: d, OTP: otp }),
    });
    if (!res.ok) {
      return Response.json({ error: { http_code: 502, message: 'sms failed' } }, { status: 500 });
    }
  }
  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
});
