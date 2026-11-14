import { Pressable, Text, View } from 'react-native';
import { STAGE_LABELS, STAGES, type Stage } from '@ward9/domain';
import { colors } from '../theme';

export function StageHeader({ current, onPress }: { current: Stage; onPress?: (s: Stage) => void }) {
  const idx = STAGES.indexOf(current);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {STAGES.map((s, i) => {
        const active = s === current;
        const done = i < idx;
        return (
          <Pressable
            key={s}
            onPress={() => onPress?.(s)}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
              backgroundColor: active ? colors.teal : done ? '#D9EBEB' : colors.card,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            <Text style={{ color: active ? '#fff' : colors.ink, fontSize: 12, fontWeight: '600' }}>
              {i + 1}. {STAGE_LABELS[s]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
