import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface WeaknessEntry {
  type: string;
  avg_multiplier: number;
  classification: 'weak' | 'neutral' | 'resist';
  defending_types: Array<{ name: string; multiplier: number }>;
}

export interface ScanResult {
  team: Array<{ name: string; found: boolean }>;
  weakness_profile: WeaknessEntry[];
  offensive_coverage: string[];
  uncovered_types: string[];
  recommended_cover: string[];
}

const ALL_18_TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
  'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
];

const TYPE_COLUMNS: Record<string, string> = {
  Normal:   'def_vs_normal',
  Fire:     'def_vs_fire',
  Water:    'def_vs_water',
  Electric: 'def_vs_electric',
  Grass:    'def_vs_grass',
  Ice:      'def_vs_ice',
  Fighting: 'def_vs_fighting',
  Poison:   'def_vs_poison',
  Ground:   'def_vs_ground',
  Flying:   'def_vs_flying',
  Psychic:  'def_vs_psychic',
  Bug:      'def_vs_bug',
  Rock:     'def_vs_rock',
  Ghost:    'def_vs_ghost',
  Dragon:   'def_vs_dragon',
  Dark:     'def_vs_dark',
  Steel:    'def_vs_steel',
  Fairy:    'def_vs_fairy',
};

// Types that are effective against a given weakness type — used for recommendation
const TYPE_COVERAGE: Record<string, string[]> = {
  Normal:   ['Fighting'],
  Fire:     ['Water', 'Ground', 'Rock'],
  Water:    ['Electric', 'Grass'],
  Electric: ['Ground'],
  Grass:    ['Fire', 'Ice', 'Poison', 'Flying', 'Bug'],
  Ice:      ['Fire', 'Fighting', 'Rock', 'Steel'],
  Fighting: ['Flying', 'Psychic', 'Fairy'],
  Poison:   ['Ground', 'Psychic'],
  Ground:   ['Water', 'Grass', 'Ice'],
  Flying:   ['Electric', 'Ice', 'Rock'],
  Psychic:  ['Bug', 'Ghost', 'Dark'],
  Bug:      ['Fire', 'Flying', 'Rock'],
  Rock:     ['Water', 'Grass', 'Fighting', 'Ground', 'Steel'],
  Ghost:    ['Ghost', 'Dark'],
  Dragon:   ['Ice', 'Dragon', 'Fairy'],
  Dark:     ['Fighting', 'Bug', 'Fairy'],
  Steel:    ['Fire', 'Fighting', 'Ground'],
  Fairy:    ['Poison', 'Steel'],
};

@Injectable()
export class Engine9Service {
  private readonly logger = new Logger(Engine9Service.name);

  constructor(private readonly db: DatabaseService) {}

  async scanTeam(names: string[]): Promise<ScanResult> {
    // Fetch each Pokemon from DB
    const pokemonRows: Array<Record<string, unknown> & { name: string; type_1: string; type_2?: string }> = [];
    const teamStatus: Array<{ name: string; found: boolean }> = [];

    for (const name of names) {
      const result = await this.db.query(
        `SELECT name, type_1, type_2,
                def_vs_normal, def_vs_fire, def_vs_water, def_vs_electric,
                def_vs_grass, def_vs_ice, def_vs_fighting, def_vs_poison,
                def_vs_ground, def_vs_flying, def_vs_psychic, def_vs_bug,
                def_vs_rock, def_vs_ghost, def_vs_dragon
         FROM pokemon_data WHERE LOWER(name) = $1`,
        [name.toLowerCase()],
      );
      if (result.rows.length > 0) {
        pokemonRows.push(result.rows[0] as Record<string, unknown> & { name: string; type_1: string; type_2?: string });
        teamStatus.push({ name: (result.rows[0] as { name: string }).name, found: true });
      } else {
        teamStatus.push({ name, found: false });
        this.logger.warn(`Engine9: Pokemon not found: ${name}`);
      }
    }

    if (pokemonRows.length === 0) {
      return {
        team: teamStatus,
        weakness_profile: [],
        offensive_coverage: [],
        uncovered_types: ALL_18_TYPES,
        recommended_cover: [],
      };
    }

    // Build weakness profile for each of 18 types
    const weakness_profile: WeaknessEntry[] = ALL_18_TYPES.map((typeName) => {
      const col = TYPE_COLUMNS[typeName];
      const defending_types = pokemonRows.map((p) => {
        // Default to 1.0 if column doesn't exist (e.g. Dark/Steel/Fairy in Gen 1)
        const val = col && p[col] !== undefined && p[col] !== null
          ? parseFloat(String(p[col]))
          : 1.0;
        return { name: p.name, multiplier: val };
      });

      const avg_multiplier =
        defending_types.reduce((sum, d) => sum + d.multiplier, 0) /
        defending_types.length;

      let classification: 'weak' | 'neutral' | 'resist';
      if (avg_multiplier > 1.5) {
        classification = 'weak';
      } else if (avg_multiplier < 0.75) {
        classification = 'resist';
      } else {
        classification = 'neutral';
      }

      return {
        type: typeName,
        avg_multiplier: Math.round(avg_multiplier * 1000) / 1000,
        classification,
        defending_types,
      };
    });

    // Offensive coverage: unique types from type_1 and type_2
    const coverageSet = new Set<string>();
    for (const p of pokemonRows) {
      if (p.type_1) coverageSet.add(p.type_1);
      if (p.type_2) coverageSet.add(p.type_2 as string);
    }
    const offensive_coverage = Array.from(coverageSet);

    // Uncovered types (not in team's type repertoire)
    const uncovered_types = ALL_18_TYPES.filter(
      (t) => !offensive_coverage.includes(t),
    );

    // Recommended cover: find uncovered types that best address team weaknesses
    const weakTypes = weakness_profile
      .filter((e) => e.classification === 'weak')
      .map((e) => e.type);

    const typeScore: Record<string, number> = {};
    for (const uncoveredType of uncovered_types) {
      const counters = TYPE_COVERAGE[uncoveredType] ?? [];
      typeScore[uncoveredType] = counters.filter((t) =>
        weakTypes.includes(t),
      ).length;
    }

    const recommended_cover = uncovered_types
      .filter((t) => typeScore[t] > 0)
      .sort((a, b) => typeScore[b] - typeScore[a])
      .slice(0, 2);

    return {
      team: teamStatus,
      weakness_profile,
      offensive_coverage,
      uncovered_types,
      recommended_cover,
    };
  }
}
