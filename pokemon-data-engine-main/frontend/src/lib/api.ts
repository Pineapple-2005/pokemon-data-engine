import type {
  Pokemon,
  Engine1Response,
  Engine2Response,
  Engine3Response,
  ModelMetrics,
  PredictionWithResult,
  AuditEntry,
  CounterMetrics,
  LeaderboardEntry,
  ArchiveStats,
  CommentaryResponse,
  ChatResponse,
  ScanResult,
  ReplayEvent,
  TrainerProfile,
} from '@/types';
import { getAuthHeader } from './auth';

const BASE = '/api';

/** All NestJS responses are wrapped in { success: true, data: T }. */
interface ApiEnvelope<T> { success: boolean; data: T }

/**
 * Generic fetch helper. Automatically unwraps NestJS { success, data } envelopes
 * so callers receive the inner payload directly.
 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    try {
      const payload = JSON.parse(text) as { error?: unknown; message?: unknown };
      const message = payload.error ?? payload.message;
      if (typeof message === 'string') throw new Error(message);
      if (Array.isArray(message)) throw new Error(message.join(', '));
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(text || `HTTP ${res.status}`);
      }
      throw err;
    }
    throw new Error(text || `HTTP ${res.status}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const json: unknown = await res.json();
  // Unwrap NestJS { success, data } envelope if present
  if (json !== null && typeof json === 'object' && 'data' in json && 'success' in json) {
    return (json as ApiEnvelope<T>).data;
  }
  return json as T;
}

export const api = {
  // ---------------------------------------------------------------------------
  // Pokémon
  // ---------------------------------------------------------------------------
  getPokemon(filters?: { role?: string; type?: string; is_assigned?: number }): Promise<Pokemon[]> {
    const params = new URLSearchParams();
    if (filters?.role) params.set('role', filters.role);
    if (filters?.type) params.set('type', filters.type);
    if (filters?.is_assigned !== undefined) params.set('is_assigned', String(filters.is_assigned));
    const qs = params.toString();
    const path = qs ? `/pokemon?${qs}` : '/pokemon';
    return request<Pokemon[]>(path);
  },

  getAssignedPokemon(): Promise<Pokemon[]> {
    return request<Pokemon[]>('/pokemon?is_assigned=1');
  },

  getPokemonByName(name: string): Promise<Pokemon> {
    return request<Pokemon>(`/pokemon/${encodeURIComponent(name)}`);
  },

  getMyPool(): Promise<Array<Pokemon & { user_assigned: boolean }>> {
    return request<Array<Pokemon & { user_assigned: boolean }>>('/pokemon/my-pool');
  },

  assignPokemon(pokemonId: number): Promise<void> {
    return request<void>('/pokemon/assign', {
      method: 'POST',
      body: JSON.stringify({ pokemon_id: pokemonId }),
    });
  },

  unassignPokemon(pokemonId: number): Promise<void> {
    return request<void>('/pokemon/assign', {
      method: 'DELETE',
      body: JSON.stringify({ pokemon_id: pokemonId }),
    });
  },

  // ---------------------------------------------------------------------------
  // Engine 1
  // ---------------------------------------------------------------------------
  getShowdownExport(): Promise<{ text: string; team_names: string[]; ps_link: string }> {
    return request<{ text: string; team_names: string[]; ps_link: string }>('/engine1/showdown-export-json');
  },

  generateGymLeaderTeam(
    theme: string,
    difficulty: 'easy' | 'medium' | 'hard',
    region?: string,
    gymLeaderName?: string,
    section?: string,
    groupName?: string,
    previousTeam?: string[],
    previousLineups?: string[][],
    variationSeed?: number,
  ): Promise<Engine1Response> {
    return request<Engine1Response>('/engine1/generate', {
      method: 'POST',
      body: JSON.stringify({
        theme,
        difficulty,
        region,
        gym_leader_name: gymLeaderName,
        section,
        group_name: groupName,
        previous_team: previousTeam,
        previous_lineups: previousLineups,
        variation_seed: variationSeed,
      }),
    });
  },

  importTeam(showdown_text: string): Promise<{ found: Pokemon[]; not_found: string[] }> {
    return request<{ found: Pokemon[]; not_found: string[] }>('/pokemon/import-team', {
      method: 'POST',
      body: JSON.stringify({ showdown_text }),
    });
  },

  // ---------------------------------------------------------------------------
  // Engine 2
  // ---------------------------------------------------------------------------
  getCounterTeam(
    opponentTeam: string[],
    challengerRegion?: string,
    section?: string,
    groupName?: string,
  ): Promise<Engine2Response> {
    return request<Engine2Response>('/engine2/counter', {
      method: 'POST',
      body: JSON.stringify({ opponent_team: opponentTeam, challenger_region: challengerRegion, section, group_name: groupName }),
    });
  },

  getCounterSuccessRate(): Promise<CounterMetrics> {
    return request<CounterMetrics>('/engine2/metrics');
  },

  // ---------------------------------------------------------------------------
  // Engine 3
  // ---------------------------------------------------------------------------
  predictBattle(
    matchId: string,
    battlerA: string,
    battlerB: string,
    teamA: string[],
    teamB: string[]
  ): Promise<Engine3Response> {
    return request<Engine3Response>('/engine3/predict', {
      method: 'POST',
      body: JSON.stringify({
        match_id: matchId,
        battler_a: battlerA,
        battler_b: battlerB,
        team_a: teamA,
        team_b: teamB,
      }),
    });
  },

  recordBattleResult(
    matchId: string,
    actualWinner: string,
    replayLink?: string,
    screenshotLink?: string,
    finalScore?: string
  ): Promise<void> {
    return request<void>('/engine3/result', {
      method: 'POST',
      body: JSON.stringify({
        match_id: matchId,
        actual_winner: actualWinner,
        replay_link: replayLink,
        screenshot_link: screenshotLink,
        final_score: finalScore,
      }),
    });
  },

  getBattleHistory(): Promise<PredictionWithResult[]> {
    return request<PredictionWithResult[]>('/engine3/history');
  },

  getAccuracyMetrics(): Promise<ModelMetrics> {
    return request<ModelMetrics>('/engine3/accuracy');
  },

  // ---------------------------------------------------------------------------
  // Audit
  // ---------------------------------------------------------------------------
  getAuditLog(limit?: number): Promise<AuditEntry[]> {
    const qs = limit ? `?limit=${limit}` : '';
    return request<AuditEntry[]>(`/audit${qs}`);
  },

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------
  register(
    username: string,
    password: string,
    section?: string,
    trainerFields?: {
      display_name?: string; trainer_class?: string; trainer_card_color?: string;
      starter_pokemon?: string; hometown?: string; favorite_type?: string;
      trainer_title?: string; rival_name?: string; trainer_id?: string;
    },
  ): Promise<TrainerProfile & { access_token: string }> {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, section, ...trainerFields }),
    });
  },

  login(
    username: string,
    password: string,
  ): Promise<TrainerProfile & { access_token: string }> {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  getMyProfile(): Promise<TrainerProfile> {
    return request<TrainerProfile>('/auth/profile');
  },

  updateProfile(data: Partial<TrainerProfile>): Promise<TrainerProfile> {
    return request<TrainerProfile>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  getPublicProfile(username: string): Promise<TrainerProfile> {
    return request<TrainerProfile>(`/auth/profile/${encodeURIComponent(username)}`);
  },

  // ---------------------------------------------------------------------------
  // Engine 4 — Archive
  // ---------------------------------------------------------------------------
  getLeaderboard(): Promise<LeaderboardEntry[]> {
    return request<LeaderboardEntry[]>('/archive/leaderboard');
  },

  getArchiveStats(): Promise<ArchiveStats> {
    return request<ArchiveStats>('/archive/stats');
  },

  // ---------------------------------------------------------------------------
  // Engine 5 — Commentator
  // ---------------------------------------------------------------------------
  generateCommentary(match_id: string): Promise<CommentaryResponse> {
    return request<CommentaryResponse>('/engine5/comment', {
      method: 'POST',
      body: JSON.stringify({ match_id }),
    });
  },

  // ---------------------------------------------------------------------------
  // Engine 6 — Pokedex AI
  // ---------------------------------------------------------------------------
  chatWithOak(question: string): Promise<ChatResponse> {
    return request<ChatResponse>('/engine6/chat', {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
  },

  // ---------------------------------------------------------------------------
  // Engine 9 — Scanner
  // ---------------------------------------------------------------------------
  scanTeam(names: string[]): Promise<ScanResult> {
    const q = names.filter(Boolean).join(',');
    return request<ScanResult>(`/engine9/scan?names=${encodeURIComponent(q)}`);
  },

  // ---------------------------------------------------------------------------
  // Engine 10 — Replay timeline
  // ---------------------------------------------------------------------------
  getReplayTimeline(id: string): Promise<ReplayEvent[]> {
    return request<ReplayEvent[]>(`/replay/${encodeURIComponent(id)}/timeline`);
  },
};
