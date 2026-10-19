// Reads from Supabase (RLS decides what each user gets) and turns rows into the shapes the
// scoring package reads. Computation stays in @chutbol/scoring; this file only fetches.
import { useQuery } from '@tanstack/react-query';
import {
  roundFromRows, type EventRow, type Id, type LeagueRow, type MatchRow, type MemberRow, type RatePart, type RatingRow,
  type Round, type RoundRow, type TeamPlayerRow, type TeamRow,
} from '@chutbol/shared';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export interface MyLeague { memberId: Id; role: MemberRow['role']; league: Pick<LeagueRow, 'id' | 'name' | 'season'> }

/** Leagues the signed-in user plays in (through their roster entries). */
export function useMyLeagues() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ['myLeagues', userId],
    enabled: !!userId,
    queryFn: async (): Promise<MyLeague[]> => {
      const rows = must(await supabase
        .from('league_members')
        .select('id, role, league:leagues(id, name, season)')
        .eq('profile_id', userId!));
      return (rows as unknown as { id: Id; role: MemberRow['role']; league: MyLeague['league'] }[])
        .map(r => ({ memberId: r.id, role: r.role, league: r.league }))
        .sort((a, b) => a.league.name.localeCompare(b.league.name));
    },
  });
}

export interface LeagueData {
  league: LeagueRow;
  members: MemberRow[];
  myRole: MemberRow['role'] | null;
  rounds: Pick<RoundRow, 'id' | 'number' | 'season' | 'status' | 'voided' | 'created_at'>[];
}

export function useLeague(leagueId: Id) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ['league', leagueId, userId],
    queryFn: async (): Promise<LeagueData> => {
      const [league, members, rounds] = await Promise.all([
        supabase.from('leagues').select('*').eq('id', leagueId).single(),
        supabase.from('league_members').select('*').eq('league_id', leagueId).order('name'),
        supabase.from('rounds').select('id, number, season, status, voided, created_at').eq('league_id', leagueId).order('created_at', { ascending: false }),
      ]);
      const m = must(members) as MemberRow[];
      return {
        league: must(league) as LeagueRow,
        members: m,
        myRole: m.find(x => x.profile_id === userId)?.role ?? null,
        rounds: must(rounds) as LeagueData['rounds'],
      };
    },
  });
}

export interface RoundData {
  round: Round;
  names: Record<Id, string>;
  isAdmin: boolean;
  /** 🔒 rating breakdowns per match and player; only filled for admins (RLS returns nothing to others) */
  parts: Record<Id, Record<Id, RatePart[]>>;
}

/** One round with its teams, matches, events and stored match ratings. */
export function useRound(roundId: Id) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ['round', roundId, userId],
    queryFn: async (): Promise<RoundData> => {
      const round = must(await supabase.from('rounds').select('*').eq('id', roundId).single()) as RoundRow;
      const [teams, matches, members] = await Promise.all([
        supabase.from('teams').select('*').eq('round_id', roundId),
        supabase.from('matches').select('*').eq('round_id', roundId),
        supabase.from('league_members').select('id, name, role, profile_id').eq('league_id', round.league_id),
      ]);
      const teamRows = must(teams) as TeamRow[];
      const matchRows = must(matches) as MatchRow[];
      const memberRows = must(members) as Pick<MemberRow, 'id' | 'name' | 'role' | 'profile_id'>[];
      const teamIds = teamRows.map(t => t.id);
      const matchIds = matchRows.map(m => m.id);
      const isAdmin = memberRows.some(m => m.profile_id === userId && m.role === 'admin');
      const [teamPlayers, events, ratings, parts] = await Promise.all([
        teamIds.length ? supabase.from('team_players').select('*').in('team_id', teamIds) : { data: [], error: null },
        matchIds.length ? supabase.from('events').select('*').in('match_id', matchIds) : { data: [], error: null },
        matchIds.length ? supabase.from('ratings').select('*').in('match_id', matchIds) : { data: [], error: null },
        isAdmin && matchIds.length ? supabase.from('rating_parts').select('*').in('match_id', matchIds) : { data: [], error: null },
      ]);
      const partsByMatch: RoundData['parts'] = {};
      for (const p of must(parts) as { match_id: Id; member_id: Id; parts: RatePart[] }[]) {
        (partsByMatch[p.match_id] ??= {})[p.member_id] = p.parts;
      }
      return {
        round: roundFromRows({
          round,
          teams: teamRows,
          teamPlayers: must(teamPlayers) as TeamPlayerRow[],
          matches: matchRows,
          events: must(events) as EventRow[],
          ratings: must(ratings) as RatingRow[],
        }),
        names: Object.fromEntries(memberRows.map(m => [m.id, m.name])),
        isAdmin,
        parts: partsByMatch,
      };
    },
  });
}
