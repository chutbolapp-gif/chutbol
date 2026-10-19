// Home: not signed in -> login. Signed in -> the leagues this account plays in.
import { Redirect, router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { useMyLeagues } from '@/data/queries';
import { useLanguage } from '@/i18n/LanguageProvider';
import { formatPhone } from '@/lib/phone';
import { colors } from '@/theme/colors';
import { Button, Card, Loadable, ui } from '@/ui/kit';

export default function Home() {
  const { t } = useTranslation();
  const { toggle, reloadFailed } = useLanguage();
  const { ready, session, signOut } = useAuth();
  const leagues = useMyLeagues();

  if (!ready) return <View style={ui.center}><ActivityIndicator color={colors.accent} /></View>;
  if (!session) return <Redirect href="/login" />;

  return (
    <ScrollView contentContainerStyle={[ui.page, { paddingTop: 56 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topRow}>
        <Button title={t('lang.toggle')} onPress={() => void toggle()} kind="ghost" />
        <Button title={t('auth.signOut')} onPress={() => void signOut()} kind="ghost" />
      </View>
      <Text style={styles.brand}>{t('app.name')}</Text>
      <Text style={ui.h1}>{t('home.title')}</Text>
      {!!session.user.phone && <Text style={[ui.muted, { textAlign: 'center' }]}>{t('home.signedInAs', { phone: formatPhone(session.user.phone) })}</Text>}
      {reloadFailed && <Text style={styles.warn}>{t('lang.reloadFailed')}</Text>}

      <Loadable loading={leagues.isLoading} error={leagues.error} onRetry={() => void leagues.refetch()}>
        {leagues.data && leagues.data.length === 0 && (
          <Card>
            <Text style={ui.h2}>{t('home.noLeagueTitle')}</Text>
            <Text style={ui.muted}>{t('home.noLeagueHint')}</Text>
          </Card>
        )}
        {leagues.data?.map(x => (
          <Pressable key={x.league.id} onPress={() => router.push({ pathname: '/league/[id]', params: { id: x.league.id } })} style={({ pressed }) => pressed && ui.pressed}>
            <Card>
              <View style={ui.row}>
                <Text style={ui.h2}>{x.league.name}</Text>
                <Text style={styles.role}>{t(`roles.${x.role}`)}</Text>
              </View>
              {!!x.league.season && <Text style={ui.muted}>{x.league.season}</Text>}
            </Card>
          </Pressable>
        ))}
      </Loadable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between' },
  brand: { color: colors.accent, fontSize: 40, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  warn: { color: colors.gold, fontSize: 13, textAlign: 'center' },
  role: { color: colors.gold, fontSize: 13, fontWeight: '700' },
});
