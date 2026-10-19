/// <reference types="node" />
// Prototype data -> database rows (the import script) -> back to scoring shapes (what the app does
// with rows from Supabase). The scoring must give exactly the golden results on the way back, for
// the real data and every synthetic fixture. This is the import's "same as the prototype" gate.
import { describe, expect, it } from 'vitest';
import { autoGk, gkCounts, playerOVR, rateMatch, roundScores, teamDay } from '@chutbol/scoring';
import { leagueFromRows, ratingsDocFromSecrets, roundFromRows, type Round } from '@chutbol/shared';
import { datasets, normalize, partLabelHe, STYLE_HE } from '../../../packages/scoring/test/helpers';
import { toRows, type Dataset, type ProtoLeague, type ProtoRound } from '../../../scripts/import-prototype/rows';

describe.each(datasets)('database round trip – $label', d => {
  const data: Dataset = {
    leagues: d.leagues as ProtoLeague[],
    rounds: d.rounds as ProtoRound[],
    ratings: d.leagues.map(l => d.ratingsFor(l.id)).filter(x => x !== undefined),
  };
  const rows = toRows(data);
  const rebuilt: Round[] = rows.rounds.map(round => {
    const teams = rows.teams.filter(t => t.round_id === round.id);
    const matches = rows.matches.filter(m => m.round_id === round.id);
    const mids = new Set(matches.map(m => m.id));
    return roundFromRows({
      round, teams, matches,
      teamPlayers: rows.teamPlayers.filter(p => teams.some(t => t.id === p.team_id)),
      events: rows.events.filter(e => mids.has(e.match_id)),
      ratings: rows.ratings.filter(r => mids.has(r.match_id)),
      fixtures: rows.fixtures.filter(f => f.round_id === round.id),
    });
  });
  const docOf = (lid: string) => {
    const secrets = rows.secrets.filter(s => s.league_id === lid);
    return d.ratingsFor(lid) ? ratingsDocFromSecrets(lid, secrets) : undefined;
  };

  it.each(rebuilt.map(r => ({ id: r.id, r })))('round $id: rateMatch, roundScores, teamDay, keepers', ({ r }) => {
    const doc = docOf(r.leagueId);
    const gm = d.golden(`rateMatch/${r.id}.json`);
    if (gm) {
      for (const [mid, g] of Object.entries<any>(gm.matches)) {
        const m = r.matches.find(x => x.id === mid)!;
        const x = rateMatch(r, m, doc);
        const parts = Object.fromEntries(Object.entries(x.parts).map(([p, P]) => [p, P.map(part => [partLabelHe(part), part.v])]));
        expect(normalize({ n: m.n, ratings: x.ratings, str: x.str, parts }), mid).toEqual(g);
        // the ratings stored in the database are the current formula's
        expect(m.ratings, mid).toEqual(x.ratings);
      }
    }
    const rs = d.golden(`roundScores/${r.id}.json`);
    expect(normalize(roundScores(r, 'field'))).toEqual(rs.field);
    expect(normalize(roundScores(r, 'gk'))).toEqual(rs.gk);
    expect(normalize(teamDay(r))).toEqual(d.golden(`teamDay/${r.id}.json`).teamDay);
    const gk = d.golden(`gk/${r.id}.json`);
    for (const t of r.teams) {
      expect(normalize(gkCounts(r, t.id)), t.id).toEqual(gk.teams[t.id].counts);
      expect(autoGk(r, t.id), t.id).toEqual(gk.teams[t.id].auto);
    }
  });

  it.each(rows.leagues.map(l => ({ id: l.id, l })))('league $id: playerOVR', ({ l }) => {
    const members = rows.members.filter(m => m.league_id === l.id);
    const secrets = rows.secrets.filter(s => s.league_id === l.id);
    const league = leagueFromRows(l, members, secrets);
    const doc = docOf(l.id);
    const g = d.golden(`playerOVR/${l.id}.json`);
    for (const pid of Object.keys(g.players)) for (const role of ['f', 'g'] as const) for (const isAdmin of [true, false]) {
      const v = playerOVR({ league, rounds: rebuilt, ratings: doc, pid, role, isAdmin });
      const asGolden = v && {
        ...v, pos: STYLE_HE[v.pos], hist: v.hist.map(({ roundId, ...h }) => ({ r: roundId, ...h })),
        raw: v.ovr, scaled: v.ovr, capped: false, attS: null, top: {}, bonus: 0, aw: { mvp: 0, top: 0, ast: 0, champ: 0 }, blendW: 0,
      };
      expect(normalize(asGolden), `${pid} ${role} ${isAdmin}`).toEqual(g.players[pid][role][isAdmin ? 'admin' : 'member'] ?? null);
    }
  });
});
