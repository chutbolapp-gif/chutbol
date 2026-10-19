// Step 1 of phone login: enter the number, Supabase sends a one-time code.
// In development only Supabase test numbers work (fixed code, no SMS is sent).
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLanguage } from '@/i18n/LanguageProvider';
import { normalizePhone } from '@/lib/phone';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { Button, Card, ui } from '@/ui/kit';
import { colors } from '@/theme/colors';

export default function Login() {
  const { t } = useTranslation();
  const { toggle } = useLanguage();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const phone = normalizePhone(input);
    if (!phone) { setError(t('auth.badPhone')); return; }
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.signInWithOtp({ phone: `+${phone}` });
    setBusy(false);
    if (e) { setError(t('auth.sendFailed', { msg: e.message })); return; }
    router.push({ pathname: '/verify', params: { phone } });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[ui.page, styles.page]}>
        <View style={styles.top}>
          <Button title={t('lang.toggle')} onPress={() => void toggle()} kind="ghost" />
        </View>
        <Text style={styles.brand}>{t('app.name')}</Text>
        <Text style={ui.h1}>{t('auth.title')}</Text>
        <Card>
          {!supabaseConfigured && <Text style={ui.error}>{t('auth.notConfigured')}</Text>}
          <Text style={ui.text}>{t('auth.phoneLabel')}</Text>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t('auth.phonePlaceholder')}
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            style={[ui.input, { writingDirection: 'ltr' }]}
            onSubmitEditing={() => void send()}
            accessibilityLabel={t('auth.phoneLabel')}
          />
          {error && <Text style={ui.error}>{error}</Text>}
          <Button title={busy ? t('common.loading') : t('auth.sendCode')} onPress={() => void send()} disabled={busy || !input.trim()} />
          <Text style={ui.muted}>{t('auth.devHint')}</Text>
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { justifyContent: 'center', paddingTop: 56 },
  top: { position: 'absolute', top: 48, end: 16 },
  brand: { color: colors.accent, fontSize: 40, fontWeight: '900', textAlign: 'center' },
});
