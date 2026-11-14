import { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, radius, space } from '../theme';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Body({ children }: { children: ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />;
}

export function Button({
  label,
  onPress,
  disabled,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'ghost' | 'danger';
}) {
  const bg = tone === 'danger' ? colors.danger : tone === 'ghost' ? colors.card : colors.teal;
  const fg = tone === 'ghost' ? colors.teal : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : 1 }]}
    >
      <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({ label, tone }: { label: string; tone?: 'mlc' | 'ok' | 'warn' | 'teal' }) {
  const bg =
    tone === 'mlc' ? '#FCE8E6' : tone === 'ok' ? '#E6F4EA' : tone === 'warn' ? colors.warn : colors.banner;
  const fg =
    tone === 'mlc' ? colors.danger : tone === 'ok' ? colors.ok : tone === 'warn' ? colors.accent : colors.teal;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontWeight: '600', fontSize: 12 }}>{label}</Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.teal, borderColor: colors.teal }]}
    >
      <Text style={{ color: selected ? '#fff' : colors.ink, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, paddingBottom: 48, gap: space.sm },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink },
  body: { fontSize: 16, color: colors.muted, lineHeight: 22 },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink, marginTop: 8 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  btn: { borderRadius: radius, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnText: { fontSize: 16, fontWeight: '700' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 8,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
});
