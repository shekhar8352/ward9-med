import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase, supabaseConfigured } from '../../src/data/supabase';
import { useSession, demoUserForPhone } from '../../src/state/session';
import { Body, Button, Field, Label, Screen, Title } from '../../src/components/ui';

export default function PhoneScreen() {
  const [phone, setPhone] = useState('+91');
  const session = useSession();

  async function send() {
    session.setPhone(phone);
    if (supabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) {
        Alert.alert('Could not send code', error.message);
        return;
      }
    } else if (!demoUserForPhone(phone)) {
      Alert.alert('Invite only', 'This number is not on the ward list. Demo numbers end with 000001 (admin), 000002, 000003.');
      return;
    }
    router.push('/(auth)/otp');
  }

  return (
    <Screen>
      <Title>Ward Checklist</Title>
      <Body>Invite-only. Use the hospital mobile number that an admin registered.</Body>
      <Label>Mobile number</Label>
      <Field keyboardType="phone-pad" value={phone} onChangeText={setPhone} autoFocus />
      <Button label="Send code" onPress={send} />
      <Body>Demo: +919999000001 admin, +919999000002 Dr Asha, +919999000003 Dr Bharat. Code 123456.</Body>
    </Screen>
  );
}
