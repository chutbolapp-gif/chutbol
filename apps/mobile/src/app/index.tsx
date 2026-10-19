import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { demoRound } from '@/demo/round';
import { useLanguage } from '@/i18n/LanguageProvider';
import { colors } from '@/theme/colors';

export default function Home() {
  const { t } = useTranslation();
  const { toggle, reloadFailed } = useLanguage();
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.hero}>
        <View style={styles.topRow}>
          <Pressable
            onPress={() => void toggle()}
            accessibilityRole="button"
            accessibilityLabel={t('lang.toggleA11y')}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Text style={styles.iconBtnText}>{t('lang.toggle')}</Text>
          </Pressable>
        </View>
        <Text style={styles.brand}>{t('app.name')}</Text>
        <Text style={styles.h1}>{t('app.title')}</Text>
        <Text style={styles.tagline}>{t('app.tagline')}</Text>
        {reloadFailed && <Text style={styles.warn}>{t('lang.reloadFailed')}</Text>}
      </View>

      <Pressable onPress={() => router.push('/demo/ratings')} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <Text style={styles.cardTitle}>{t('home.demoTitle')}</Text>
        <Text style={styles.muted}>{t('home.demoHint', { n: demoRound().number })}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingTop: 56, gap: 16, flexGrow: 1, backgroundColor: colors.bg },
  hero: { alignItems: 'center', gap: 8 },
  topRow: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'flex-end' },
  iconBtn: {
    minWidth: 44, height: 44, borderRadius: 12, paddingHorizontal: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line,
  },
  iconBtnText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  brand: { color: colors.accent, fontSize: 40, fontWeight: '900', marginTop: 8 },
  h1: { color: colors.text, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  tagline: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  warn: { color: colors.gold, fontSize: 13, textAlign: 'center' },
  card: { backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: 16, padding: 16, gap: 6 },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 14 },
  pressed: { opacity: 0.7 },
});
