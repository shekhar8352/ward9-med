import { useEffect } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CLIENT_VERSION, isClientAllowed } from '@ward9/domain';
import { loadStore, thisDeviceRevoked } from '../src/data/memoryStore';
import { getOrCreateDbKey } from '../src/security/pin';
import { seedFictionalPatients } from '../src/data/demoSeed';
import { startPhotoQueueOnReconnect } from '../src/data/photoQueue';
import { useSession } from '../src/state/session';
import { wipeDevice } from '../src/security/wipe';
import { getState } from '../src/data/memoryStore';
import { colors } from '../src/theme';
import { Body, Title, Screen } from '../src/components/ui';
import { registerPushToken } from '../src/notifications/push';
import { rescheduleReminders } from '../src/notifications/localReminders';

export default function RootLayout() {
  const session = useSession();

  useEffect(() => {
    (async () => {
      await loadStore();
      try {
        await getOrCreateDbKey();
      } catch (err) {
        console.warn('db key', err);
      }
      if (process.env.EXPO_PUBLIC_DEMO !== '0') {
        try {
          seedFictionalPatients();
        } catch (err) {
          console.warn('demo seed', err);
        }
      }
      await session.boot();
      startPhotoQueueOnReconnect();
      await registerPushToken();
      await rescheduleReminders();
    })();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') void session.noteBackground();
      if (next === 'active') {
        void session.noteForeground();
        startPhotoQueueOnReconnect();
        if (thisDeviceRevoked()) void wipeDevice('remote revoke');
      }
    });
    return () => sub.remove();
  }, []);

  if (!session.ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  const hospital = getState().hospital;
  if (!isClientAllowed(hospital.min_client_version, CLIENT_VERSION)) {
    return (
      <Screen>
        <Title>Update Ward Checklist</Title>
        <Body>This phone is on an older version. Update before ticking items.</Body>
      </Screen>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}
