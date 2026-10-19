// Small shared building blocks in the prototype's dark style.
import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme/colors';

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[ui.card, style]}>{children}</View>;
}

export function Button({ title, onPress, disabled, kind = 'primary' }: { title: string; onPress: () => void; disabled?: boolean; kind?: 'primary' | 'ghost' }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [kind === 'primary' ? ui.btn : ui.btnGhost, (pressed || disabled) && ui.pressed]}
    >
      <Text style={kind === 'primary' ? ui.btnText : ui.btnGhostText}>{title}</Text>
    </Pressable>
  );
}

/** Loading spinner, error text with retry, or the content. */
export function Loadable({ loading, error, onRetry, children }: PropsWithChildren<{ loading: boolean; error: unknown; onRetry?: () => void }>): ReactNode {
  const { t } = useTranslation();
  if (loading) return <View style={ui.center}><ActivityIndicator color={colors.accent} /></View>;
  if (error) {
    return (
      <View style={[ui.center, { gap: 12 }]}>
        <Text style={ui.error}>{t('errors.load')}</Text>
        <Text style={ui.muted}>{error instanceof Error ? error.message : String(error)}</Text>
        {onRetry && <Button title={t('common.retry')} onPress={onRetry} kind="ghost" />}
      </View>
    );
  }
  return <>{children}</>;
}

export const ui = StyleSheet.create({
  page: { padding: 16, gap: 12, flexGrow: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  h1: { color: colors.text, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  h2: { color: colors.text, fontSize: 18, fontWeight: '800' },
  text: { color: colors.text, fontSize: 15 },
  muted: { color: colors.muted, fontSize: 13 },
  error: { color: colors.bad, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  input: {
    backgroundColor: colors.panel2, borderColor: colors.line, borderWidth: 1, borderRadius: 12,
    color: colors.text, fontSize: 20, paddingHorizontal: 14, paddingVertical: 12, textAlign: 'center', letterSpacing: 1,
  },
  btn: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnText: { color: colors.bg, fontSize: 16, fontWeight: '800' },
  btnGhost: { borderColor: colors.line, borderWidth: 1, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center' },
  btnGhostText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pressed: { opacity: 0.6 },
});
