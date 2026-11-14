import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { tryBiometrics, verifyPin } from '../../src/security/pin';
import { useSession } from '../../src/state/session';
import { Body, Button, Field, Label, Screen, Title } from '../../src/components/ui';

export default function UnlockScreen() {
  const [pin, setPin] = useState('');
  const session = useSession();

  useEffect(() => {
    tryBiometrics().then((ok) => {
      if (ok) {
        session.unlock();
        router.replace('/(app)/patients');
      }
    });
  }, []);

  async function unlock() {
    const res = await verifyPin(pin);
    if (res.lockedOut) {
      Alert.alert('PIN locked', 'Request a new SMS code.');
      await session.logout();
      router.replace('/(auth)/phone');
      return;
    }
    if (!res.ok) {
      Alert.alert('Wrong PIN', `${res.remaining} tries left`);
      return;
    }
    session.unlock();
    router.replace('/(app)/patients');
  }

  return (
    <Screen>
      <Title>Unlock</Title>
      <Body>Enter your PIN. The checklist stays on this phone until you sync.</Body>
      <Label>PIN</Label>
      <Field keyboardType="number-pad" secureTextEntry maxLength={4} value={pin} onChangeText={setPin} />
      <Button label="Unlock" onPress={unlock} disabled={pin.length !== 4} />
    </Screen>
  );
}
