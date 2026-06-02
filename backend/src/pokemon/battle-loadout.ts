import type { Pokemon } from '../common/interfaces/pokemon.interface';
import type {
  CounterRecommendation,
  TeamSlot,
  TournamentLoadout,
} from '../ml/ml-client.service';

type AttackStyle = 'physical' | 'special';

interface TypeMoves {
  physical: string;
  special: string;
}

interface TeamPlan {
  hazardsAssigned: boolean;
  statusMoves: Set<string>;
  coverageMoves: Set<string>;
}

// TYPE_MOVES: Both entries for each type must be broadly learnable TM/level-up
// moves for most Pokemon of that type.  Avoid species-exclusive tutor moves
// (Brave Bird, Flare Blitz, Seed Bomb, Wild Charge, Aura Sphere, Zen Headbutt,
// Power Gem) which fail Showdown legality for the majority of a type's species.
const TYPE_MOVES: Record<string, TypeMoves> = {
  normal:   { physical: 'Body Slam',      special: 'Hyper Voice' },
  fire:     { physical: 'Flame Charge',   special: 'Flamethrower' },
  water:    { physical: 'Waterfall',      special: 'Surf' },
  electric: { physical: 'Spark',          special: 'Thunderbolt' },
  grass:    { physical: 'Razor Leaf',     special: 'Energy Ball' },
  ice:      { physical: 'Ice Shard',      special: 'Ice Beam' },
  fighting: { physical: 'Brick Break',    special: 'Focus Blast' },
  poison:   { physical: 'Poison Jab',     special: 'Sludge Bomb' },
  ground:   { physical: 'Earthquake',     special: 'Earth Power' },
  flying:   { physical: 'Aerial Ace',     special: 'Air Slash' },
  psychic:  { physical: 'Psycho Cut',     special: 'Psychic' },
  bug:      { physical: 'X-Scissor',      special: 'Bug Buzz' },
  rock:     { physical: 'Rock Slide',     special: 'Ancient Power' },
  ghost:    { physical: 'Shadow Claw',    special: 'Shadow Ball' },
  dragon:   { physical: 'Dragon Claw',    special: 'Dragon Pulse' },
  dark:     { physical: 'Bite',           special: 'Dark Pulse' },
  steel:    { physical: 'Iron Head',      special: 'Flash Cannon' },
  fairy:    { physical: 'Disarming Voice', special: 'Moonblast' },
};

const COVERAGE_MOVES: Record<AttackStyle, string[]> = {
  // All physical coverage moves are broadly distributed TMs
  physical: ['Earthquake', 'Rock Slide', 'Brick Break', 'Aerial Ace', 'Shadow Claw'],
  // All special coverage moves are broadly distributed TMs
  special:  ['Ice Beam', 'Thunderbolt', 'Flamethrower', 'Energy Ball', 'Shadow Ball'],
};

const STRONG_ABILITIES = [
  'wonder-guard', 'magic-guard', 'regenerator', 'multiscale', 'speed-boost',
  'intimidate', 'levitate', 'guts', 'poison-heal', 'technician', 'sturdy',
  'serene-grace', 'natural-cure', 'pressure',
];

// LEARNSET-CHECKED fallbacks: run through canLearn() so they are only used
// when the Pokemon's PokéAPI learnset confirms it can learn them.
// Moves with narrow species pools (Stealth Rock, Roost, Defog, U-turn,
// Volt Switch, Leech Seed, Reflect, Light Screen, Encore, Rapid Spin,
// Substitute, Soft-Boiled, Wish) are intentionally excluded here.
const FALLBACK_MOVES = [
  'Protect', 'Rest', 'Toxic', 'Thunder Wave', 'Will-O-Wisp',
  'Recover', 'Body Slam', 'Earthquake', 'Rock Slide',
  'Ice Beam', 'Thunderbolt', 'Flamethrower', 'Energy Ball', 'Shadow Ball',
  'Brick Break', 'Aerial Ace',
];

// SAFE_FALLBACK_MOVES: used only when the PokéAPI learnset fetch failed
// (learnset === undefined).  These are TMs/HMs available to virtually every
// Pokemon in the main series games, making them safe to assign without
// individual learnset verification.
const SAFE_FALLBACK_MOVES = [
  'Protect', 'Toxic', 'Rest', 'Body Slam', 'Earthquake',
  'Ice Beam', 'Flamethrower', 'Thunderbolt',
];

const learnsetCache = new Map<number, Promise<Set<string> | undefined>>();

function moveSlug(move: string): string {
  return move.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function canLearn(move: string | undefined, learnset?: Set<string>): move is string {
  return Boolean(move) && (learnset === undefined || learnset.has(moveSlug(move as string)));
}

async function fetchLearnset(pokemon?: Pokemon): Promise<Set<string> | undefined> {
  if (!pokemon?.pokeapi_id) return undefined;

  const cached = learnsetCache.get(pokemon.pokeapi_id);
  if (cached) return cached;

  const request = (async () => {
    try {
      const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemon.pokeapi_id}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return undefined;
      const data = await response.json() as { moves?: Array<{ move?: { name?: string } }> };
      return new Set(
        (data.moves ?? [])
          .map((entry) => entry.move?.name)
          .filter((name): name is string => Boolean(name)),
      );
    } catch {
      return undefined;
    }
  })();

  learnsetCache.set(pokemon.pokeapi_id, request);
  return request;
}

function displayCase(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function chooseAbility(pokemon?: Pokemon): string {
  const available = [
    pokemon?.ability_1,
    pokemon?.ability_2,
    pokemon?.hidden_ability,
  ].filter((ability): ability is string => Boolean(ability));

  if (available.length === 0) return 'Pressure';

  const ranked = [...available].sort((a, b) => {
    const aRank = STRONG_ABILITIES.indexOf(a.toLowerCase());
    const bRank = STRONG_ABILITIES.indexOf(b.toLowerCase());
    return (aRank === -1 ? Number.MAX_SAFE_INTEGER : aRank)
      - (bRank === -1 ? Number.MAX_SAFE_INTEGER : bRank);
  });

  return displayCase(ranked[0]);
}

function chooseStyle(pokemon?: Pokemon): AttackStyle {
  return (pokemon?.special_attack ?? 0) > (pokemon?.attack ?? 0)
    ? 'special'
    : 'physical';
}

function addMove(moves: string[], move: string | undefined, learnset?: Set<string>): boolean {
  if (canLearn(move, learnset) && !moves.includes(move) && moves.length < 4) {
    moves.push(move);
    return true;
  }
  return false;
}

function chooseStatusMove(plan: TeamPlan, learnset?: Set<string>): string | undefined {
  for (const move of ['Thunder Wave', 'Toxic', 'Will-O-Wisp']) {
    if (!plan.statusMoves.has(move) && canLearn(move, learnset)) {
      plan.statusMoves.add(move);
      return move;
    }
  }
  return ['Toxic', 'Thunder Wave', 'Will-O-Wisp'].find((move) => canLearn(move, learnset));
}

function chooseCoverageMove(
  style: AttackStyle,
  plan: TeamPlan,
  moves: string[],
  learnset?: Set<string>,
): string | undefined {
  const choices = COVERAGE_MOVES[style];
  const selected = choices.find((move) => canLearn(move, learnset) && !plan.coverageMoves.has(move) && !moves.includes(move))
    ?? choices.find((move) => canLearn(move, learnset) && !moves.includes(move));
  if (!selected) return undefined;
  plan.coverageMoves.add(selected);
  return selected;
}

function chooseRecoveryMove(learnset?: Set<string>): string | undefined {
  // Roost is flying-specific, Soft-Boiled is Chansey/Blissey only —
  // skip them when there is no learnset to validate against.
  const candidates = learnset !== undefined
    ? ['Recover', 'Roost', 'Soft-Boiled', 'Wish', 'Rest']
    : ['Recover', 'Rest'];
  return candidates.find((move) => canLearn(move, learnset));
}

function chooseItem(role: string, style: AttackStyle, ability: string): string {
  if (ability === 'Guts') return 'Flame Orb';
  if (ability === 'Poison Heal') return 'Toxic Orb';
  if (ability === 'Magic Guard') return 'Life Orb';
  if (ability === 'Multiscale' || ability === 'Regenerator') return 'Heavy-Duty Boots';
  if (role === 'sweeper' || role === 'ace') return 'Life Orb';
  if (role === 'balanced') return 'Expert Belt';
  return 'Leftovers';
}

function chooseNature(role: string, style: AttackStyle, pokemon?: Pokemon): string {
  if (role === 'wall') {
    return (pokemon?.defense ?? 0) < (pokemon?.special_defense ?? 0) ? 'Bold' : 'Calm';
  }
  if (role === 'support') return 'Careful';
  return style === 'physical' ? 'Adamant' : 'Modest';
}

function chooseEvs(role: string, style: AttackStyle, pokemon?: Pokemon): string {
  if (role === 'wall' || role === 'support') {
    return (pokemon?.defense ?? 0) < (pokemon?.special_defense ?? 0)
      ? '252 HP / 252 Def / 4 SpD'
      : '252 HP / 4 Def / 252 SpD';
  }
  return style === 'physical'
    ? '4 HP / 252 Atk / 252 Spe'
    : '4 HP / 252 SpA / 252 Spe';
}

/** Add STAB move(s) for the Pokemon's primary type (and optionally type 2). */
function addStabMoves(
  moves: string[],
  slot: TeamSlot,
  style: AttackStyle,
  ability: string,
  learnset?: Set<string>,
): void {
  const type1 = TYPE_MOVES[slot.type_1?.toLowerCase() ?? 'normal'] ?? TYPE_MOVES.normal;
  const type2 = slot.type_2 ? TYPE_MOVES[slot.type_2.toLowerCase()] : undefined;
  const isDefensive = ['support', 'wall', 'tank'].includes(slot.role.toLowerCase());

  if (ability === 'Guts' && slot.type_1?.toLowerCase() === 'normal') {
    addMove(moves, 'Facade', learnset);
  } else {
    addMove(moves, type1[style], learnset);
    // Fallback to the other attack style when the preferred STAB was rejected
    if (moves.length === 0) {
      addMove(moves, type1[style === 'physical' ? 'special' : 'physical'], learnset);
    }
  }

  if (!isDefensive) addMove(moves, type2?.[style], learnset);
  // Guts users always want Facade as a second STAB
  if (ability === 'Guts') addMove(moves, 'Facade', learnset);
}

/** Add role-specific utility moves (hazards, status, recovery, setup). */
function addRoleMoves(
  moves: string[],
  role: string,
  style: AttackStyle,
  plan: TeamPlan,
  learnset?: Set<string>,
): void {
  // Stealth Rock only when learnset confirms the Pokemon can learn it
  const isDefensive = role === 'support' || role === 'wall' || role === 'tank';
  if (isDefensive && !plan.hazardsAssigned && learnset !== undefined) {
    plan.hazardsAssigned = addMove(moves, 'Stealth Rock', learnset);
  }

  if (role === 'support' || role === 'wall') {
    addMove(moves, chooseStatusMove(plan, learnset), learnset);
    addMove(moves, chooseRecoveryMove(learnset), learnset);
    addMove(moves, 'Protect', learnset);
    return;
  }

  if (role === 'tank') {
    addMove(moves, chooseCoverageMove(style, plan, moves, learnset), learnset);
    addMove(moves, chooseRecoveryMove(learnset), learnset);
    return;
  }

  // sweeper / ace / balanced
  addMove(moves, chooseCoverageMove(style, plan, moves, learnset), learnset);
  // Setup moves only when learnset can validate them
  if ((role === 'sweeper' || role === 'ace') && learnset !== undefined) {
    addMove(moves, style === 'physical' ? 'Swords Dance' : 'Calm Mind', learnset);
  }
  if (role === 'balanced') addMove(moves, chooseStatusMove(plan, learnset), learnset);
}

/** Fill remaining slots, first with learnset-checked moves then safe universals. */
function fillMoves(moves: string[], plan: TeamPlan, style: AttackStyle, learnset?: Set<string>): void {
  addMove(moves, chooseCoverageMove(style, plan, moves, learnset), learnset);
  for (const fallback of FALLBACK_MOVES) addMove(moves, fallback, learnset);
  // When learnset was unavailable many candidates were skipped — use universals
  for (const safe of SAFE_FALLBACK_MOVES) {
    if (moves.length >= 4) break;
    if (!moves.includes(safe)) moves.push(safe);
  }
}

function chooseMoves(
  slot: TeamSlot,
  pokemon: Pokemon | undefined,
  plan: TeamPlan,
  ability: string,
  learnset?: Set<string>,
): [string, string, string, string] {
  const role = slot.role.toLowerCase();
  const style = chooseStyle(pokemon);
  const moves: string[] = [];

  addStabMoves(moves, slot, style, ability, learnset);
  addRoleMoves(moves, role, style, plan, learnset);
  fillMoves(moves, plan, style, learnset);

  return moves.slice(0, 4) as [string, string, string, string];
}

function buildLoadout(
  slot: TeamSlot,
  pokemon: Pokemon | undefined,
  plan: TeamPlan,
  learnset?: Set<string>,
): TournamentLoadout {
  const role = slot.role.toLowerCase();
  const style = chooseStyle(pokemon);
  const ability = chooseAbility(pokemon);

  return {
    item: chooseItem(role, style, ability),
    ability,
    evs: chooseEvs(role, style, pokemon),
    nature: chooseNature(role, style, pokemon),
    moves: chooseMoves(slot, pokemon, plan, ability, learnset),
  };
}

export async function recommendTournamentLoadouts(
  team: TeamSlot[],
  pokemonPool: Pokemon[],
): Promise<TeamSlot[]> {
  const pokemonByName = new Map(pokemonPool.map((pokemon) => [pokemon.name.toLowerCase(), pokemon]));
  const plan: TeamPlan = {
    hazardsAssigned: false,
    statusMoves: new Set<string>(),
    coverageMoves: new Set<string>(),
  };

  const learnsets = await Promise.all(
    team.map((slot) => fetchLearnset(pokemonByName.get(slot.name.toLowerCase()))),
  );

  return team.map((slot, index) => ({
    ...slot,
    loadout: slot.loadout ?? buildLoadout(
      slot,
      pokemonByName.get(slot.name.toLowerCase()),
      plan,
      learnsets[index],
    ),
  }));
}

function assignCounterRoles(
  team: CounterRecommendation[],
  pokemonByName: Map<string, Pokemon>,
): string[] {
  const scored = team.map((counter, index) => {
    const pokemon = pokemonByName.get(counter.name.toLowerCase());
    return {
      index,
      bulk: (pokemon?.hp ?? 0) + (pokemon?.defense ?? 0) + (pokemon?.special_defense ?? 0),
      offense: Math.max(pokemon?.attack ?? 0, pokemon?.special_attack ?? 0) + (pokemon?.speed ?? 0),
    };
  });

  const roles = team.map(() => 'balanced');
  const wall = [...scored].sort((a, b) => b.bulk - a.bulk)[0];
  if (wall) roles[wall.index] = 'wall';

  const sweeper = [...scored]
    .filter((entry) => entry.index !== wall?.index)
    .sort((a, b) => b.offense - a.offense)[0];
  if (sweeper) roles[sweeper.index] = 'sweeper';

  const tank = [...scored]
    .filter((entry) => entry.index !== wall?.index && entry.index !== sweeper?.index)
    .sort((a, b) => b.bulk - a.bulk)[0];
  if (tank) roles[tank.index] = 'tank';

  return roles;
}

export async function recommendCounterTournamentLoadouts(
  team: CounterRecommendation[],
  pokemonPool: Pokemon[],
): Promise<CounterRecommendation[]> {
  const pokemonByName = new Map(pokemonPool.map((pokemon) => [pokemon.name.toLowerCase(), pokemon]));
  const roles = assignCounterRoles(team, pokemonByName);
  const slots: TeamSlot[] = team.map((counter, index) => ({
    slot: counter.rank,
    role: roles[index],
    name: counter.name,
    type_1: counter.type_1,
    type_2: counter.type_2,
    total_base_stats: counter.total_base_stats,
    usefulness_score: counter.counter_score,
    reason: counter.reason,
    loadout: counter.loadout,
  }));
  const enriched = await recommendTournamentLoadouts(slots, pokemonPool);

  return team.map((counter, index) => ({
    ...counter,
    role: enriched[index].role,
    loadout: enriched[index].loadout,
  }));
}
