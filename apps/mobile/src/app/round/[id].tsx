// A round (evening): table, players of the round, and the match ratings.
// Data from Supabase, computed with @chutbol/scoring. Admins can open a player's rating breakdown.
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRound } from '@/data/queries';
import { buildRoundView, type ViewMatch, type ViewPlayer, type ViewScore, type ViewSide } from '@/data/roundView';
import { partLabel, partValue } from '@/i18n/i18n';
import { colors } from '@/theme/colors';
import { Card, Loadable, ui } from '@/ui/kit';

const f1 = (v: number) => v.toFixed(1);
const f2 = (v: number) => v.toFixed(2);

function PlayerRow({ p }: { p: ViewPlayer }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const canOpen = !!p.parts;
  return (
    <View>
      <Pressable disabled={!canOpen} onPress={() => setOpen(o => !o)} style={({ pressed }) => [styles.row, pressed && ui.pressed]}>
        <Text style={styles.name} numberOfLines={1}>
          {p.gk ? '🧤 ' : ''}
          {p.name}
        </Text>
        <Text style={[styles.rating, p.rating >= 8 ? styles.good : p.rating <= 5 ? styles.bad : null]}>{f1(p.rating)}</Text>
      </Pressable>
      {open && p.parts && (
        <View style={styles.parts}>
          {p.parts.map((x, i) => (
            <View key={i} style={styles.partRow}>
              <Text style={styles.partLabel}>{partLabel(t, x)}</Text>
              <Text style={[styles.partValue, x.v > 0 ? styles.good : x.v < 0 ? styles.bad : ui.muted]}>{partValue(x)}</Text>
            </View>
          ))}
          <View style={styles.partRow}>
            <Text style={[styles.partLabel, { fontWeight: '800' }]}>{t('common.total')}</Text>
            <Text style={[styles.partValue, { color: colors.text, fontSize: 16 }]}>{f1(p.rating)}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function Side({ s }: { s: ViewSide }) {
  return (
    <View style={{ gap: 2, marginTop: 4 }}>
      <View style={styles.sideHead}>
        <View style={[styles.dot, { backgroundColor: s.color }]} />
        <Text style={styles.sideName}>{s.name}</Text>
      </View>
      {s.players.map(p => <PlayerRow key={p.id} p={p} />)}
    </View>
  );
}

function MatchCard({ m }: { m: ViewMatch }) {
  const { t } = useTranslation();
  return (
    <Card>
      <Text style={ui.h2}>{t('round.matchLine', { n: m.n, home: m.home.name, h: m.home.goals, a: m.away.goals, away: m.away.name })}</Text>
      <Side s={m.home} />
      <Side s={m.away} />
    </Card>
  );
}

function ScoreList({ title, rows }: { title: string; rows: ViewScore[] }) {
  const { t } = useTranslation();
  if (!rows.length) return null;
  return (
    <Card>
      <Text style={ui.h2}>{title}</Text>
      {rows.map((x, i) => (
        <View key={x.id} style={styles.tableRow}>
          <Text style={[styles.cell, styles.pos]}>{i + 1}</Text>
          <Text style={[styles.cell, styles.grow]} numberOfLines={1}>{x.name}</Text>
          <Text style={[styles.cell, ui.muted]}>{t('round.matchesN', { n: x.n })}</Text>
          <Text style={[styles.cell, styles.num]}>{f2(x.score)}</Text>
        </View>
      ))}
    </Card>
  );
}

export default function RoundScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useRound(id!);
  const view = useMemo(() => (q.data ? buildRoundView(q.data.round, q.data.names, q.data.parts) : null), [q.data]);
  return (
    <>
      <Stack.Screen options={{ title: view ? t('round.title', { n: view.number }) : t('common.loading') }} />
      <Loadable loading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
        {view && (
          <ScrollView contentContainerStyle={ui.page}>
            {view.voided && <Text style={ui.error}>{t('round.voidedNote')}</Text>}
            <Card>
              <Text style={ui.h2}>{t('round.table')}</Text>
              <View style={styles.tableRow}>
                <Text style={[styles.cell, styles.pos]}>#</Text>
                <Text style={[styles.cell, styles.grow, ui.muted]}>{t('round.team')}</Text>
                <Text style={[styles.cell, styles.num, ui.muted]}>{t('round.played')}</Text>
                <Text style={[styles.cell, styles.num, ui.muted]}>{t('round.goals')}</Text>
                <Text style={[styles.cell, styles.num, ui.muted]}>{t('round.points')}</Text>
              </View>
              {view.table.map((r, i) => (
                <View key={r.id} style={styles.tableRow}>
                  <Text style={[styles.cell, styles.pos]}>{i + 1}</Text>
                  <View style={[styles.grow, styles.sideHead]}>
                    <View style={[styles.dot, { backgroundColor: r.color }]} />
                    <Text style={styles.cell} numberOfLines={1}>{r.name}</Text>
                  </View>
                  <Text style={[styles.cell, styles.num]}>{r.p}</Text>
                  <Text style={[styles.cell, styles.num, { writingDirection: 'ltr' }]}>{`${r.gf}-${r.ga}`}</Text>
                  <Text style={[styles.cell, styles.num, { fontWeight: '800' }]}>{r.pts}</Text>
                </View>
              ))}
            </Card>
            <ScoreList title={t('round.players')} rows={view.field.slice(0, 5)} />
            <ScoreList title={t('round.keepers')} rows={view.keepers} />
            <Text style={ui.muted}>{q.data?.isAdmin ? t('round.adminHint') : t('round.memberHint')}</Text>
            {view.matches.map(m => <MatchCard key={m.id} m={m} />)}
          </ScrollView>
        )}
      </Loadable>
    </>
  );
}

const styles = StyleSheet.create({
  sideHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  sideName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.panel2,
  },
  name: { color: colors.text, fontSize: 15, flexShrink: 1 },
  rating: { color: colors.text, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  parts: { paddingHorizontal: 12, paddingVertical: 6, gap: 4 },
  partRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  partLabel: { color: colors.text, fontSize: 13, flexShrink: 1 },
  partValue: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  cell: { color: colors.text, fontSize: 14 },
  pos: { width: 20, color: colors.muted },
  grow: { flex: 1 },
  num: { minWidth: 36, textAlign: 'center', fontVariant: ['tabular-nums'] },
  good: { color: colors.good },
  bad: { color: colors.bad },
});
