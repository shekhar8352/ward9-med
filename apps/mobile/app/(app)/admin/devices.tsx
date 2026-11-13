import { Text } from 'react-native';
import { getState, revokeDevice } from '../../../src/data/memoryStore';
import { useDb } from '../../../src/data/hooks';
import { Body, Button, Card, Screen, Title } from '../../../src/components/ui';

export default function DevicesScreen() {
  const db = useDb();
  return (
    <Screen>
      <Title>Devices</Title>
      <Body>Revoke a lost phone. Wipe runs the next time that phone syncs.</Body>
      {db.devices.map((d) => (
        <Card key={d.id}>
          <Text>
            {getState().users.find((u) => u.id === d.user_id)?.name} · {d.device_label ?? d.id}
          </Text>
          <Body>{d.revoked_at ? `Revoked ${d.revoked_at}` : 'Active'}</Body>
          {!d.revoked_at ? <Button label="Revoke" tone="danger" onPress={() => revokeDevice(d.id)} /> : null}
        </Card>
      ))}
    </Screen>
  );
}
