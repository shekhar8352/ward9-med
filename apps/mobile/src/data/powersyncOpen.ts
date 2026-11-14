import { getOrCreateDbKey } from '../security/pin';
import { POWER_SYNC_TABLES } from './schema';
import { POWERSYNC_URL } from './powersync';

/**
 * Open the SQLCipher database in a development / production native build.
 *
 *   npx expo install @powersync/react-native @op-engineering/op-sqlite
 *   package.json: { "op-sqlite": { "sqlcipher": true } }
 *
 * Demo / Expo Go keeps using memoryStore. This helper is the production entry.
 */
export async function openPowerSyncDatabase(): Promise<null> {
  if (!POWERSYNC_URL) return null;
  const key = await getOrCreateDbKey();
  void key;
  void POWER_SYNC_TABLES;
  // Native import is gated so Expo Go still bundles.
  // const { PowerSyncDatabase } = await import('@powersync/react-native');
  // const { OPSqliteOpenFactory } = await import('@op-engineering/op-sqlite');
  return null;
}
