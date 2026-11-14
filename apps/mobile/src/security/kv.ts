import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * SecureStore has no native module on web (and some Expo web builds
 * crash with getValueWithKeyAsync is not a function). Native phones
 * still use the keystore.
 */
function isWeb(): boolean {
  return Platform.OS === 'web';
}

export async function kvGet(key: string): Promise<string | null> {
  if (isWeb()) {
    try {
      return globalThis.localStorage?.getItem(key) ?? (await AsyncStorage.getItem(key));
    } catch {
      return AsyncStorage.getItem(key);
    }
  }
  try {
    const SecureStore = await import('expo-secure-store');
    if (typeof SecureStore.getItemAsync === 'function') {
      return await SecureStore.getItemAsync(key);
    }
  } catch {
    /* fall through */
  }
  return AsyncStorage.getItem(key);
}

export async function kvSet(key: string, value: string): Promise<void> {
  if (isWeb()) {
    try {
      globalThis.localStorage?.setItem(key, value);
      return;
    } catch {
      await AsyncStorage.setItem(key, value);
      return;
    }
  }
  try {
    const SecureStore = await import('expo-secure-store');
    if (typeof SecureStore.setItemAsync === 'function') {
      await SecureStore.setItemAsync(key, value);
      return;
    }
  } catch {
    /* fall through */
  }
  await AsyncStorage.setItem(key, value);
}

export async function kvDel(key: string): Promise<void> {
  if (isWeb()) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* ignore */
    }
    await AsyncStorage.removeItem(key);
    return;
  }
  try {
    const SecureStore = await import('expo-secure-store');
    if (typeof SecureStore.deleteItemAsync === 'function') {
      await SecureStore.deleteItemAsync(key);
      return;
    }
  } catch {
    /* fall through */
  }
  await AsyncStorage.removeItem(key);
}
