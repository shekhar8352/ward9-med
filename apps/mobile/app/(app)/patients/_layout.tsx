import { Stack } from 'expo-router';
import { colors } from '../../../src/theme';

export default function PatientsStack() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.teal },
        headerTintColor: '#fff',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Patients' }} />
      <Stack.Screen name="new" options={{ title: 'Register' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Admission' }} />
      <Stack.Screen name="[id]/stage/[stage]" options={{ title: 'Stage' }} />
      <Stack.Screen name="[id]/photos" options={{ title: 'Photos' }} />
      <Stack.Screen name="[id]/team" options={{ title: 'Team' }} />
    </Stack>
  );
}
