// A league: its rounds, newest first.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLeague } from '@/data/queries';
import { colors } from '@/theme/colors';
import { Card, Loadable, ui } from '@/ui/kit';

export default function LeagueScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useLeague(id!);
  return (
    <>
      <Stack.Screen options={{ title: q.data?.league.name ?? t('common.loading') }} />
      <Loadable loading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
        {q.data && (
          <FlatList
            data={q.data.rounds}
            keyExtractor={r => r.id}
            contentContainerStyle={ui.page}
            ListHeaderComponent={
              <View style={{ gap: 4, marginBottom: 4 }}>
                <Text style={ui.muted}>{t('league.players', { n: q.data.members.length })}</Text>
                {q.data.myRole && <Text style={styles.role}>{t(`roles.${q.data.myRole}`)}</Text>}
              </View>
            }
            ListEmptyComponent={<Text style={ui.muted}>{t('league.noRounds')}</Text>}
            renderItem={({ item: r }) => (
              <Pressable onPress={() => router.push({ pathname: '/round/[id]', params: { id: r.id } })} style={({ pressed }) => pressed && ui.pressed}>
                <Card>
                  <View style={ui.row}>
                    <Text style={ui.h2}>{t('round.title', { n: r.number })}</Text>
                    <Text style={[styles.status, r.voided && styles.voided]}>{r.voided ? t('round.voided') : t(`round.status.${r.status as 'setup' | 'live' | 'done'}`)}</Text>
                  </View>
                  <Text style={ui.muted}>{r.season}</Text>
                </Card>
              </Pressable>
            )}
          />
        )}
      </Loadable>
    </>
  );
}

const styles = StyleSheet.create({
  role: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  status: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  voided: { color: colors.bad },
});
