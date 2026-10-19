import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { demoRound, type DemoMatch, type DemoPlayer, type DemoSide } from '@/demo/round';
import { partLabel, partValue } from '@/i18n/i18n';
import { colors } from '@/theme/colors';

const fmt = (v: number) => v.toFixed(1);

function PlayerRow({ p }: { p: DemoPlayer }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setOpen(o => !o)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <Text style={styles.name} numberOfLines={1}>
          {p.gk ? '🧤 ' : ''}
          {p.name}
        </Text>
        <Text style={[styles.rating, p.rating >= 7 ? styles.good : p.rating < 5 ? styles.bad : null]}>{fmt(p.rating)}</Text>
      </Pressable>
      {open && (
        <View style={styles.parts}>
          {p.parts.map((x, i) => (
            <View key={i} style={styles.partRow}>
              <Text style={styles.partLabel}>{partLabel(t, x)}</Text>
              <Text style={[styles.partValue, x.v > 0 ? styles.good : x.v < 0 ? styles.bad : styles.mutedText]}>{partValue(x)}</Text>
            </View>
          ))}
          <View style={styles.partRow}>
            <Text style={[styles.partLabel, styles.bold]}>{t('common.total')}</Text>
            <Text style={[styles.partValue, styles.total]}>{fmt(p.rating)}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function Side({ s }: { s: DemoSide }) {
  return (
    <View style={styles.side}>
      <View style={styles.sideHead}>
        <View style={[styles.dot, { backgroundColor: s.color }]} />
        <Text style={styles.sideName}>{s.name}</Text>
      </View>
      {s.players.map(p => (
        <PlayerRow key={p.id} p={p} />
      ))}
    </View>
  );
}

function MatchCard({ m }: { m: DemoMatch }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('demo.matchRatings', { n: m.n })}</Text>
      <Text style={styles.mutedText}>
        {t('demo.matchLine', { n: m.n, home: m.home.name, h: m.home.goals, a: m.away.goals, away: m.away.name })}
      </Text>
      <Side s={m.home} />
      <Side s={m.away} />
    </View>
  );
}

export default function RatingsDemo() {
  const { t } = useTranslation();
  const round = demoRound();
  return (
    <>
      <Stack.Screen options={{ title: t('demo.round', { n: round.number }) }} />
      <FlatList
        data={round.matches}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.page}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.mutedText}>{t('demo.tapHint')}</Text>
            <Text style={styles.devNote}>{t('demo.devNote')}</Text>
          </View>
        }
        renderItem={({ item }) => <MatchCard m={item} />}
      />
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, backgroundColor: colors.bg },
  header: { gap: 4, marginBottom: 4 },
  devNote: { color: colors.gold, fontSize: 12 },
  card: { backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  side: { gap: 2, marginTop: 4 },
  sideHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
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
  total: { color: colors.text, fontSize: 17 },
  bold: { fontWeight: '800' },
  good: { color: colors.good },
  bad: { color: colors.bad },
  mutedText: { color: colors.muted, fontSize: 13 },
  pressed: { opacity: 0.7 },
});
