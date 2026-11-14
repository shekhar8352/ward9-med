/**
 * PowerSync production path.
 *
 * Open SQLCipher via OP-SQLite in a development build:
 *   npx expo install @powersync/react-native @op-engineering/op-sqlite
 * and set EXPO_PUBLIC_POWERSYNC_URL.
 *
 * Demo and Expo Go use memoryStore instead. Writes always go through
 * app.upsert_checklist_entry / app.advance_stage so RLS still applies.
 */

export const POWERSYNC_URL = process.env.EXPO_PUBLIC_POWERSYNC_URL ?? '';
export const powersyncConfigured = Boolean(POWERSYNC_URL);

export const powerSyncSchemaTables = [
  'users',
  'user_devices',
  'hospitals',
  'patients',
  'admissions',
  'admission_team',
  'checklist_items',
  'workflow_transitions',
  'checklist_entries',
  'attachments',
  'stage_transitions',
] as const;

export function sqlcipherNote(): string {
  return 'On-device encryption uses SQLCipher (OP-SQLite) with a key in the OS keystore. The key is not derived from the PIN, so sync can continue while the UI is locked.';
}
