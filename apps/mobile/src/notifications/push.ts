import { setPushToken } from '../data/memoryStore';

export async function registerPushToken(): Promise<void> {
  try {
    const Notifications = await import('expo-notifications');
    const Device = await import('expo-device');
    if (!Device.isDevice) return;
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== 'granted') return;
    const token = await Notifications.getExpoPushTokenAsync();
    setPushToken(token.data);
  } catch {
    /* Expo Go / simulator */
  }
}
