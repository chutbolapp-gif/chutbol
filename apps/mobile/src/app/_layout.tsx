import { LocaleProvider, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { isRtlLang, type Lang } from '@/i18n/i18n';
import { bootLanguage } from '@/i18n/language';
import { LanguageProvider } from '@/i18n/LanguageProvider';
import { colors } from '@/theme/colors';

export default function RootLayout() {
  const [lang, setLang] = useState<Lang | null>(null);

  useEffect(() => {
    let live = true;
    void bootLanguage().then(l => live && l && setLang(l));
    return () => {
      live = false;
    };
  }, []);

  if (!lang) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const direction = isRtlLang(lang) ? 'rtl' : 'ltr';
  return (
    <SafeAreaProvider>
      <LanguageProvider initial={lang}>
        {/* direction on the root view: RTL layout even where I18nManager is not set (Expo Go) */}
        <View style={[styles.root, { direction }]}>
          <LocaleProvider direction={direction}>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.bg2 },
                headerTintColor: colors.text,
                headerTitleStyle: { fontWeight: '800' },
                contentStyle: { backgroundColor: colors.bg },
              }}
            />
          </LocaleProvider>
        </View>
        <StatusBar style="light" />
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
});
