# Ward 9 Orthopaedic Checklist

Offline-first Android and iOS checklist for one 23-doctor orthopaedic ward. Admissions move through six stages. Rules live in Postgres so a policy change does not need an app release.

During the pilot the paper case sheet is the official medical record.

## Stack

- Expo (React Native, TypeScript), EAS Build / Update
- PowerSync Cloud in `ap-south-1` (India) + SQLCipher on device
- Supabase Postgres, Auth, Storage in Mumbai
- MSG91 for invite-only phone OTP (DLT-registered template)
- Domain rules in `packages/domain` (TypeScript) and `app.eval_condition` (PL/pgSQL), sharing `packages/domain/fixtures/rules.json`

Demo mode (`EXPO_PUBLIC_DEMO` not `0`) runs the full workflow on-device without cloud credentials.

## Repo

```
apps/mobile          Expo app
packages/domain      Rules, gates, fixtures, Jest tests
supabase/migrations  Schema, RLS, audit, LWW, advance_stage
supabase/functions   send-sms, discharge-pdf, dispatch-push
supabase/powersync   Sync streams (active admissions only)
docs/PILOT.md        Two-week ward pilot
```

## Develop

```bash
npm install
npm test -w @ward9/domain
cd apps/mobile
npx expo start
```

Demo logins:

- Admin `+919999000001`
- Dr Asha `+919999000002`
- Dr Bharat `+919999000003`
- OTP `123456`

## Production wiring

1. Create a Supabase project in **Mumbai (`ap-south-1`)**. Enable the IPv4 add-on.
2. `supabase db push` the migrations. Enable the custom access token hook (`app.custom_access_token_hook`) and the Send SMS hook (`send-sms`).
3. Create a PowerSync Cloud instance in region `in`. Paste [supabase/powersync/sync-config.yaml](supabase/powersync/sync-config.yaml). Publication must include `app` tables except `audit_log`.
4. Set `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_POWERSYNC_URL`. Set `EXPO_PUBLIC_DEMO=0`.
5. Register DLT + MSG91 before real OTP. Unknown numbers never receive a code.
6. Development build (not Expo Go) for SQLCipher: `npx expo install @powersync/react-native @op-engineering/op-sqlite` and enable `"op-sqlite": { "sqlcipher": true }` in `package.json`.

## Security notes

- Invite-only OTP, then PIN / biometrics, 15-minute lock.
- RLS: active ward visibility; discharged history is admin / short sync window.
- Audit log is append-only and is **not** synced to phones.
- Photo consent gates the camera. No WhatsApp share sheet. Screenshot block on the photo viewer and PDF.
- Remote device revoke wipes SQLCipher, photos, and the session on next sync.

## Tests

```bash
npm test -w @ward9/domain
# after supabase start
psql "$SUPABASE_DB_URL" -f scripts/sql-tests.sql
supabase test db   # pgTAP in supabase/tests
```
