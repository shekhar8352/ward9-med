import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { STAGE_LABELS, buildContext, isItemApplicable, type Stage } from '@ward9/domain';
import { useAdmissionBundle } from '../../../../../src/data/hooks';
import { updateAdmission } from '../../../../../src/data/memoryStore';
import { FieldRenderer } from '../../../../../src/components/FieldRenderer';
import { Body, Card, Chip, Label, Screen, Title } from '../../../../../src/components/ui';

export default function StageScreen() {
  const { id, stage } = useLocalSearchParams<{ id: string; stage: Stage }>();
  const { admission, patient, entries, items } = useAdmissionBundle(id);
  if (!admission || !patient) return <Screen><Body>Not on this phone.</Body></Screen>;

  const ctx = buildContext({ patient, admission, entries, items });
  const stageItems = items
    .filter((i) => i.stage === stage)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <Screen>
      <Title>{STAGE_LABELS[stage]}</Title>
      {stage === 'ward' ? (
        <Card>
          <Label>Wound type</Label>
          <Chip
            label="Compound"
            selected={admission.wound_type === 'compound'}
            onPress={() => updateAdmission(admission.id, { wound_type: 'compound' })}
          />
          <Chip
            label="Non-compound"
            selected={admission.wound_type === 'non_compound'}
            onPress={() => updateAdmission(admission.id, { wound_type: 'non_compound' })}
          />
        </Card>
      ) : null}
      {stageItems.map((item) => {
        const applies = isItemApplicable(item, ctx);
        if (applies.ruleError) {
          return (
            <Card key={item.item_key}>
              <Text>Rule error on {item.label}</Text>
              <Body>{applies.ruleError}</Body>
            </Card>
          );
        }
        if (!applies.can) return null;
        const entry = entries.find((e) => e.item_key === item.item_key);
        return (
          <Card key={item.item_key}>
            <FieldRenderer
              item={item}
              entry={entry}
              admissionId={admission.id}
              photoConsent={admission.photo_consent === true}
            />
          </Card>
        );
      })}
      {stage === 'registration' ? (
        <Body>Edit identity on the registration form. Advance from the admission screen when complete.</Body>
      ) : null}
    </Screen>
  );
}
