import { Stack } from 'expo-router';
import { colors } from '../../../src/theme';

export default function AdminStack() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.teal },
        headerTintColor: '#fff',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Admin' }} />
      <Stack.Screen name="users" options={{ title: 'Doctors' }} />
      <Stack.Screen name="devices" options={{ title: 'Devices' }} />
      <Stack.Screen name="audit" options={{ title: 'Audit log' }} />
    </Stack>
  );
}
