import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearPinAndKey } from './pin';
import { resetStore } from '../data/memoryStore';

export async function wipeDevice(reason: string): Promise<void> {
  await resetStore();
  await AsyncStorage.clear();
  await clearPinAndKey();
  console.warn('device wiped', reason);
}
