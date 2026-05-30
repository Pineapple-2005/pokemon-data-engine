import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface ReplayEvent {
  turn: number;
  type: 'move' | 'switch' | 'damage' | 'heal' | 'faint' | 'turn' | 'win';
  player?: 'p1' | 'p2';
  pokemon?: string;
  detail?: string;
}

export interface ReplaySummary {
  replay_id: string;
  format: string;
  p1: string;
  p2: string;
  winner: string | null;
  upload_time: number;
  synced_at: string;
}

// Shape returned by the PS replay search API
interface PsReplaySearchItem {
  id: string;
  p1: string;
  p2: string;
  format: string;
  uploadtime: number;
  rating: number;
}

interface PsReplaySearchResponse {
  battles: PsReplaySearchItem[];
}

// Shape returned by the PS individual replay API
interface PsReplayDetail {
  log: string;
}

@Injectable()
export class ReplayService {
  private readonly logger = new Logger(ReplayService.name);

  constructor(private readonly db: DatabaseService) {}

  // ---------------------------------------------------------------------------
  // syncReplays
  // Fetches recent replays from the PS API and upserts them into showdown_replay.
  // ---------------------------------------------------------------------------
  async syncReplays(
    format = 'gen1ou',
    limit = 50,
  ): Promise<{ synced: number; skipped: number }> {
    const searchUrl = `https://replay.pokemonshowdown.com/api/replays/search?format=${format}&limit=${limit}`;

    let battles: PsReplaySearchItem[];
    try {
      const res = await fetch(searchUrl);
      const json = (await res.json()) as PsReplaySearchResponse;
      battles = json.battles ?? [];
    } catch (err) {
      this.logger.error(`Failed to fetch replay search results: ${(err as Error).message}`);
      return { synced: 0, skipped: 0 };
    }

    let synced = 0;
    let skipped = 0;

    for (const battle of battles) {
      const exists = await this.db.replayExists(battle.id);
      if (exists) {
        skipped++;
        continue;
      }

      // Fetch full replay to extract winner from the battle log
      let winner: string | null = null;
      try {
        const detailRes = await fetch(`https://replay.pokemonshowdown.com/${battle.id}.json`);
        const detail = (await detailRes.json()) as PsReplayDetail;
        winner = this.extractWinner(detail.log ?? '');
      } catch (err) {
        this.logger.warn(`Could not fetch replay detail for ${battle.id}: ${(err as Error).message}`);
      }

      try {
        await this.db.insertReplay({
          replay_id:   battle.id,
          format:      battle.format,
          p1:          battle.p1,
          p2:          battle.p2,
          winner,
          upload_time: battle.uploadtime,
          synced_at:   new Date().toISOString(),
        });
        synced++;
      } catch (err) {
        this.logger.error(`Failed to insert replay ${battle.id}: ${(err as Error).message}`);
        skipped++;
      }
    }

    this.logger.log(`Replay sync complete — synced: ${synced}, skipped: ${skipped}`);
    return { synced, skipped };
  }

  // ---------------------------------------------------------------------------
  // getRecentReplays
  // ---------------------------------------------------------------------------
  async getRecentReplays(limit = 20): Promise<ReplaySummary[]> {
    return this.db.findRecentReplays(limit) as Promise<ReplaySummary[]>;
  }

  // ---------------------------------------------------------------------------
  // getTimeline
  // Fetches a PS replay by ID and parses its log into structured events.
  // ---------------------------------------------------------------------------
  async getTimeline(replayId: string): Promise<ReplayEvent[]> {
    const url = `https://replay.pokemonshowdown.com/${replayId}.json`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Replay not found: ${replayId} (HTTP ${res.status})`);
    }
    const json = (await res.json()) as { log?: string };
    const log = json.log ?? '';
    return this.parseLog(log);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Scans the PS battle log for a |win|{username} line and returns the
   * username, or null if not found.
   */
  private extractWinner(log: string): string | null {
    for (const line of log.split('\n')) {
      if (line.startsWith('|win|')) {
        return line.slice(5).trim() || null;
      }
    }
    return null;
  }

  /**
   * Parses a PS battle log string into structured ReplayEvent objects.
   * Delegates each command type to a focused helper to keep complexity low.
   */
  private parseLog(log: string): ReplayEvent[] {
    const events: ReplayEvent[] = [];
    let currentTurn = 0;

    for (const line of log.split('\n')) {
      if (!line.startsWith('|')) continue;
      const parts = line.slice(1).split('|');
      const cmd = parts[0];

      if (cmd === 'turn') {
        currentTurn = Number.parseInt(parts[1] ?? '0', 10) || 0;
        events.push({ turn: currentTurn, type: 'turn', detail: parts[1] });
      } else if (cmd === 'win') {
        events.push({ turn: currentTurn, type: 'win', detail: parts[1]?.trim() });
      } else if (cmd === 'move') {
        events.push(this.parseMoveEvent(currentTurn, parts));
      } else if (cmd === 'switch') {
        events.push(this.parseSwitchEvent(currentTurn, parts));
      } else if (cmd === 'damage' || cmd === 'heal') {
        events.push(this.parseHpEvent(currentTurn, cmd, parts));
      } else if (cmd === 'faint') {
        events.push(this.parseFaintEvent(currentTurn, parts));
      }
    }

    return events;
  }

  /** Extract the p1/p2 player tag from a PS actor string like "p1a: Pikachu". */
  private extractPlayer(actorRaw: string): 'p1' | 'p2' | undefined {
    if (actorRaw.startsWith('p1')) return 'p1';
    if (actorRaw.startsWith('p2')) return 'p2';
    return undefined;
  }

  /** Extract the Pokemon species name from a PS actor string. */
  private extractPokemon(actorRaw: string): string {
    return actorRaw.replace(/^p[12][ab]:\s*/, '').split(',')[0].trim();
  }

  private parseMoveEvent(turn: number, parts: string[]): ReplayEvent {
    const actorRaw = parts[1] ?? '';
    return {
      turn,
      type:    'move',
      player:  this.extractPlayer(actorRaw),
      pokemon: this.extractPokemon(actorRaw),
      detail:  parts[2]?.trim(),
    };
  }

  private parseSwitchEvent(turn: number, parts: string[]): ReplayEvent {
    const actorRaw  = parts[1] ?? '';
    const speciesRaw = (parts[2] ?? '').split(',')[0].trim();
    return {
      turn,
      type:    'switch',
      player:  this.extractPlayer(actorRaw),
      pokemon: speciesRaw,
    };
  }

  private parseHpEvent(turn: number, cmd: string, parts: string[]): ReplayEvent {
    const actorRaw = parts[1] ?? '';
    return {
      turn,
      type:    cmd as 'damage' | 'heal',
      player:  this.extractPlayer(actorRaw),
      pokemon: this.extractPokemon(actorRaw),
      detail:  parts[2]?.trim(),
    };
  }

  private parseFaintEvent(turn: number, parts: string[]): ReplayEvent {
    const actorRaw = parts[1] ?? '';
    return {
      turn,
      type:    'faint',
      player:  this.extractPlayer(actorRaw),
      pokemon: this.extractPokemon(actorRaw),
    };
  }
}
