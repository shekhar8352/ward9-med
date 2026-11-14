import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  isFieldTypeKnown,
  type ChecklistItem,
  type ChecklistEntry,
} from '@ward9/domain';
import { enqueuePhoto } from '../data/photoQueue';
import { upsertEntry } from '../data/memoryStore';
import { colors } from '../theme';
import { Body, Button, Chip, Field, Label } from './ui';

export function FieldRenderer({
  item,
  entry,
  admissionId,
  photoConsent,
}: {
  item: ChecklistItem;
  entry?: ChecklistEntry;
  admissionId: string;
  photoConsent: boolean;
}) {
  const rec = (entry?.value ?? {}) as Record<string, unknown>;
  const [text, setText] = useState(String(rec.value ?? rec.note ?? rec.reference ?? ''));
  const [reason, setReason] = useState(String(rec.reason ?? ''));

  if (!isFieldTypeKnown(item.field_type)) {
    return (
      <View style={{ padding: 12, backgroundColor: '#FCE8E6', borderRadius: 12 }}>
        <Text style={{ color: colors.danger, fontWeight: '700' }}>Update the app to complete this item</Text>
        <Body>{item.label}</Body>
      </View>
    );
  }

  const save = (value: Record<string, unknown>) => upsertEntry(admissionId, item.item_key, value);

  async function pickPhoto() {
    if (!photoConsent) {
      Alert.alert('Photo consent', 'Photo consent is required before the camera opens.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const id = await enqueuePhoto({
      admissionId,
      kind: item.item_key,
      localUri: res.assets[0].uri,
    });
    save({ ...rec, attachment_id: id, done: true });
  }

  if (item.item_key.startsWith('fitness.')) {
    const status = String(rec.status ?? rec.value ?? '');
    return (
      <View>
        <Label>{item.label}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {(['fit', 'unfit', 'pending'] as const).map((s) => (
            <Chip key={s} label={s} selected={status === s} onPress={() => save({ status: s, note: text })} />
          ))}
        </View>
        <Field placeholder="Note" value={text} onChangeText={setText} onEndEditing={() => save({ status, note: text })} />
      </View>
    );
  }

  if (item.item_key === 'blood.report') {
    const cleared = String(rec.cleared ?? 'pending');
    return (
      <View>
        <Label>{item.label}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {(['pending', 'fine', 'not_fine'] as const).map((s) => (
            <Chip
              key={s}
              label={s.replace('_', ' ')}
              selected={cleared === s}
              onPress={() => save({ cleared: s, status: s === 'pending' ? 'pending' : 'resulted', note: text })}
            />
          ))}
        </View>
        <Field placeholder="Note" value={text} onChangeText={setText} />
        <Button label="Add report photo" onPress={pickPhoto} tone="ghost" />
      </View>
    );
  }

  if (item.item_key === 'dressing.day2' || item.item_key === 'dressing.day4') {
    return (
      <View>
        <Label>{item.label}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Chip label="Done" selected={rec.done === true} onPress={() => save({ done: true })} />
          <Chip label="Waive" selected={rec.waived === true} onPress={() => save({ waived: true, reason })} />
        </View>
        {rec.waived ? (
          <Field
            placeholder="Reason for waiver"
            value={reason}
            onChangeText={setReason}
            onEndEditing={() => save({ waived: true, reason })}
          />
        ) : null}
      </View>
    );
  }

  if (item.field_type === 'bool' || item.item_key === 'dressing.daily') {
    const done = rec.done === true || rec.value === true;
    const no = rec.done === false || rec.value === false;
    return (
      <View>
        <Label>{item.label}</Label>
        <View style={{ flexDirection: 'row' }}>
          <Chip label="Yes" selected={done} onPress={() => save({ done: true, value: true })} />
          <Chip label="No" selected={no} onPress={() => save({ done: false, value: false })} />
        </View>
      </View>
    );
  }

  if (item.field_type === 'multi_enum') {
    const choices = ((item.options as { choices?: string[] } | undefined)?.choices ?? []) as string[];
    const selected = Array.isArray(rec.value) ? (rec.value as string[]) : [];
    return (
      <View>
        <Label>{item.label}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {choices.map((c) => {
            const on = selected.includes(c);
            return (
              <Chip
                key={c}
                label={c}
                selected={on}
                onPress={() => {
                  const next = on ? selected.filter((x) => x !== c) : [...selected, c];
                  save({ value: next });
                }}
              />
            );
          })}
        </View>
      </View>
    );
  }

  if (item.field_type === 'enum') {
    const choices = ((item.options as { choices?: string[] } | undefined)?.choices ?? []) as string[];
    return (
      <View>
        <Label>{item.label}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {choices.map((c) => (
            <Chip key={c} label={c} selected={rec.value === c} onPress={() => save({ value: c })} />
          ))}
        </View>
      </View>
    );
  }

  if (item.field_type === 'photo') {
    return (
      <View>
        <Label>{item.label}</Label>
        <Button label={rec.attachment_id ? 'Photo saved on this phone' : 'Take photo'} onPress={pickPhoto} />
        <Button label="Not taken" onPress={() => save({ not_taken: true })} tone="ghost" />
      </View>
    );
  }

  if (item.field_type === 'note_photo') {
    return (
      <View>
        <Label>{item.label}</Label>
        <Chip label="Done" selected={rec.done === true} onPress={() => save({ done: true, reference: text, note: text })} />
        <Field
          placeholder="Reference / note"
          value={text}
          onChangeText={setText}
          onEndEditing={() => save({ done: rec.done === true, reference: text, note: text })}
        />
        <Button label="Add photo" onPress={pickPhoto} tone="ghost" />
      </View>
    );
  }

  if (item.field_type === 'date') {
    return (
      <View>
        <Label>{item.label} (YYYY-MM-DD)</Label>
        <Field
          placeholder="2026-11-11"
          value={text}
          onChangeText={setText}
          onEndEditing={() => save({ value: text })}
        />
      </View>
    );
  }

  return (
    <View>
      <Label>{item.label}</Label>
      <Field
        placeholder={item.label}
        value={text}
        onChangeText={setText}
        onEndEditing={() => save({ value: text, text })}
      />
    </View>
  );
}
