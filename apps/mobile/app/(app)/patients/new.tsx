import { useState, type ReactNode } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { isRegistrationComplete, possibleDuplicate, type AyushmanStatus, type Sex } from '@ward9/domain';
import { getState, registerPatient } from '../../../src/data/memoryStore';
import { Body, Button, Chip, Field, Label, Screen, Title } from '../../../src/components/ui';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [father, setFather] = useState('');
  const [address, setAddress] = useState('');
  const [mobile, setMobile] = useState('');
  const [history, setHistory] = useState('');
  const [abha, setAbha] = useState('');
  const [broughtName, setBroughtName] = useState('');
  const [broughtRel, setBroughtRel] = useState('');
  const [broughtPhone, setBroughtPhone] = useState('');
  const [mlc, setMlc] = useState<boolean | null>(null);
  const [ayushman, setAyushman] = useState<AyushmanStatus | null>(null);
  const [consent, setConsent] = useState<boolean | null>(null);

  function save() {
    const patient = {
      name,
      age: Number(age),
      sex,
      father_name: father,
      address,
      mobile: mobile || null,
    };
    const admission = {
      brought_by_name: broughtName,
      brought_by_relation: broughtRel,
      brought_by_phone: broughtPhone || null,
      is_mlc: mlc,
      ayushman_status: ayushman,
      photo_consent: consent,
    };
    const gate = isRegistrationComplete(patient, admission);
    if (!gate.can) {
      Alert.alert('Incomplete', gate.reason);
      return;
    }
    const dup = possibleDuplicate(
      { name, mobile },
      getState().patients.map((p) => ({ name: p.name, mobile: p.mobile })),
    );
    const go = () => {
      const { admission: a } = registerPatient({
        name,
        age: Number(age),
        sex,
        father_name: father,
        address,
        mobile: mobile || null,
        past_history: history || null,
        abha_id: abha || null,
        brought_by_name: broughtName,
        brought_by_relation: broughtRel,
        brought_by_phone: broughtPhone || null,
        is_mlc: mlc as boolean,
        ayushman_status: ayushman,
        photo_consent: consent as boolean,
      });
      router.replace(`/(app)/patients/${a.id}`);
    };
    if (dup) {
      Alert.alert('Possible duplicate', 'A patient with this name or mobile is already on the list.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save anyway', onPress: go },
      ]);
      return;
    }
    go();
  }

  return (
    <Screen>
      <Title>Registration</Title>
      <Body>Past history and a file photo are optional. Photo consent is required before any photo.</Body>
      <Label>Name</Label>
      <Field value={name} onChangeText={setName} />
      <Label>Age</Label>
      <Field keyboardType="number-pad" value={age} onChangeText={setAge} />
      <Label>Sex</Label>
      <ViewRow>
        {(['male', 'female', 'other'] as const).map((s) => (
          <Chip key={s} label={s} selected={sex === s} onPress={() => setSex(s)} />
        ))}
      </ViewRow>
      <Label>Father's name</Label>
      <Field value={father} onChangeText={setFather} />
      <Label>Address</Label>
      <Field value={address} onChangeText={setAddress} />
      <Label>Patient mobile</Label>
      <Field keyboardType="phone-pad" value={mobile} onChangeText={setMobile} />
      <Label>Past history</Label>
      <Field value={history} onChangeText={setHistory} />
      <Label>ABHA ID (stored only)</Label>
      <Field value={abha} onChangeText={setAbha} />
      <Label>Brought by — name</Label>
      <Field value={broughtName} onChangeText={setBroughtName} />
      <Label>Brought by — relation</Label>
      <Field value={broughtRel} onChangeText={setBroughtRel} />
      <Label>Brought by — phone</Label>
      <Field keyboardType="phone-pad" value={broughtPhone} onChangeText={setBroughtPhone} />
      <Label>MLC</Label>
      <ViewRow>
        <Chip label="Yes" selected={mlc === true} onPress={() => setMlc(true)} />
        <Chip label="No" selected={mlc === false} onPress={() => setMlc(false)} />
      </ViewRow>
      <Label>Ayushman</Label>
      <ViewRow>
        <Chip label="None" selected={ayushman === 'none'} onPress={() => setAyushman('none')} />
        <Chip label="Applied" selected={ayushman === 'applied'} onPress={() => setAyushman('applied')} />
        <Chip label="Not applied" selected={ayushman === 'not_applied'} onPress={() => setAyushman('not_applied')} />
      </ViewRow>
      <Label>Photo consent</Label>
      <ViewRow>
        <Chip label="Yes" selected={consent === true} onPress={() => setConsent(true)} />
        <Chip label="No" selected={consent === false} onPress={() => setConsent(false)} />
      </ViewRow>
      <Button label="Save admission" onPress={save} />
    </Screen>
  );
}

function ViewRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{children}</View>;
}
