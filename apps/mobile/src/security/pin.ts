import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { kvDel, kvGet, kvSet } from './kv';

const PIN_KEY = 'ward9.pin.hash';
const BIO_KEY = 'ward9.pin.bio';
const FAIL_KEY = 'ward9.pin.fails';
const DB_KEY = 'ward9.db.key';

export async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `ward9:${pin}`);
}

export async function hasPin(): Promise<boolean> {
  return Boolean(await kvGet(PIN_KEY));
}

export async function setPin(pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be 4 digits');
  await kvSet(PIN_KEY, await hashPin(pin));
  await kvSet(FAIL_KEY, '0');
}

export async function verifyPin(pin: string): Promise<{ ok: boolean; lockedOut: boolean; remaining: number }> {
  const stored = await kvGet(PIN_KEY);
  if (!stored) return { ok: false, lockedOut: false, remaining: 5 };
  const fails = Number((await kvGet(FAIL_KEY)) ?? '0');
  if (fails >= 5) return { ok: false, lockedOut: true, remaining: 0 };
  const ok = stored === (await hashPin(pin));
  if (ok) {
    await kvSet(FAIL_KEY, '0');
    return { ok: true, lockedOut: false, remaining: 5 };
  }
  const next = fails + 1;
  await kvSet(FAIL_KEY, String(next));
  return { ok: false, lockedOut: next >= 5, remaining: Math.max(0, 5 - next) };
}

export async function enableBiometrics(on: boolean): Promise<void> {
  await kvSet(BIO_KEY, on ? '1' : '0');
}

export async function biometricsEnabled(): Promise<boolean> {
  return (await kvGet(BIO_KEY)) === '1';
}

export async function tryBiometrics(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!(await biometricsEnabled())) return false;
  try {
    const LocalAuthentication = await import('expo-local-authentication');
    const has = await LocalAuthentication.hasHardwareAsync();
    if (!has) return false;
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Ward Checklist',
      disableDeviceFallback: true,
    });
    return res.success;
  } catch {
    return false;
  }
}

export async function getOrCreateDbKey(): Promise<string> {
  const existing = await kvGet(DB_KEY);
  if (existing) return existing;
  const bytes = await Crypto.getRandomBytesAsync(32);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  await kvSet(DB_KEY, hex);
  return hex;
}

export async function clearPinAndKey(): Promise<void> {
  await kvDel(PIN_KEY);
  await kvDel(BIO_KEY);
  await kvDel(FAIL_KEY);
  await kvDel(DB_KEY);
}
