// Step 2 of phone login: the 6-digit code. On success the session is saved and we go home.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { formatPhone } from '@/lib/phone';
import { supabase } from '@/lib/supabase';
import { Button, Card, ui } from '@/ui/kit';
import { colors } from '@/theme/colors';

export default function Verify() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async (token = code) => {
    if (token.length !== 6 || !phone) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.verifyOtp({ phone: `+${phone}`, token, type: 'sms' });
    setBusy(false);
    if (e) { setError(t('auth.badCode')); return; }
    await qc.invalidateQueries();
    router.replace('/');
  };

  return (
    <>
      <Stack.Screen options={{ title: t('auth.codeTitle') }} />
      <View style={[ui.page, { justifyContent: 'center' }]}>
        <Card>
          <Text style={ui.text}>{t('auth.codeSent', { phone: phone ? formatPhone(phone) : '' })}</Text>
          <TextInput
            value={code}
            onChangeText={v => {
              const digits = v.replace(/\D/g, '').slice(0, 6);
              setCode(digits);
              if (digits.length === 6) void verify(digits);
            }}
            placeholder="••••••"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            autoFocus
            style={[ui.input, { writingDirection: 'ltr', fontSize: 28, letterSpacing: 8 }]}
            accessibilityLabel={t('auth.codeTitle')}
          />
          {error && <Text style={ui.error}>{error}</Text>}
          <Button title={busy ? t('common.loading') : t('auth.verify')} onPress={() => void verify()} disabled={busy || code.length !== 6} />
          <Button title={t('auth.changePhone')} onPress={() => router.back()} kind="ghost" />
        </Card>
      </View>
    </>
  );
}
