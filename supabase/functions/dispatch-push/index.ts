import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.includes(secret) && req.headers.get('x-webhook-secret') !== Deno.env.get('PUSH_WEBHOOK_SECRET')) {
    // Allow service role or a dedicated webhook secret.
  }
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const { data: events } = await supabase
    .schema('app')
    .from('push_events')
    .select('*')
    .is('dispatched_at', null)
    .limit(50);

  for (const event of events ?? []) {
    const { data: devices } = await supabase
      .schema('app')
      .from('user_devices')
      .select('expo_push_token, revoked_at, user_id')
      .in('user_id', event.target_user_ids ?? [])
      .is('revoked_at', null);
    const tokens = (devices ?? [])
      .map((d: { expo_push_token?: string | null }) => d.expo_push_token)
      .filter((t): t is string => Boolean(t));
    if (tokens.length > 0) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          tokens.map((to) => ({
            to,
            title: event.title,
            body: event.body,
            data: event.payload,
            sound: 'default',
          })),
        ),
      });
    }
    await supabase
      .schema('app')
      .from('push_events')
      .update({ dispatched_at: new Date().toISOString() })
      .eq('id', event.id);
  }
  return Response.json({ dispatched: (events ?? []).length });
});
