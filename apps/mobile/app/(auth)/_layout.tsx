import { Redirect, Stack } from 'expo-router';
import { useSession } from '../../src/state/session';
import { hasPin } from '../../src/security/pin';
import { useEffect, useState } from 'react';

export default function AuthLayout() {
  const { userId, locked } = useSession();
  const [pinReady, setPinReady] = useState<boolean | null>(null);
  useEffect(() => {
    hasPin().then(setPinReady);
  }, [userId]);
  if (userId && pinReady === null) return null;
  if (userId && pinReady === false) return <Redirect href="/(auth)/set-pin" />;
  if (userId && pinReady && locked) return <Redirect href="/(auth)/unlock" />;
  if (userId && !locked) return <Redirect href="/(app)/patients" />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="phone" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="set-pin" />
      <Stack.Screen name="unlock" />
    </Stack>
  );
}
