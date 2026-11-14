import { Platform } from 'react-native';

export async function protectScreen(on: boolean): Promise<void> {
  try {
    const mod = await import('expo-screen-capture');
    if (on) await mod.preventScreenCaptureAsync();
    else await mod.allowScreenCaptureAsync();
  } catch {
    if (Platform.OS === 'web') return;
  }
}
