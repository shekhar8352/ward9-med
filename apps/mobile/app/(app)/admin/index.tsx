import { router } from 'expo-router';
import { getState } from '../../../src/data/memoryStore';
import { Body, Button, Screen, Title } from '../../../src/components/ui';
import { useSession } from '../../../src/state/session';
import { pendingPhotoCount } from '../../../src/data/photoQueue';
import { Alert } from 'react-native';

export default function AdminHome() {
  const session = useSession();
  const hospital = getState().hospital;
  return (
    <Screen>
      <Title>Admin</Title>
      <Body>{hospital.name}</Body>
      <Body>Grievance: {hospital.grievance_contact}</Body>
      <Body>The paper case sheet is the official medical record during the pilot.</Body>
      <Button label="Doctors" onPress={() => router.push('/(app)/admin/users')} />
      <Button label="Devices" onPress={() => router.push('/(app)/admin/devices')} />
      <Button label="Audit log" onPress={() => router.push('/(app)/admin/audit')} />
      <Button
        label="Sign out"
        tone="ghost"
        onPress={() => {
          if (pendingPhotoCount() > 0) {
            Alert.alert('Photos still on this phone', 'Reconnect and wait for uploads before wiping.');
            return;
          }
          void session.logout();
        }}
      />
    </Screen>
  );
}
