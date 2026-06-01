/**
 * showdown.parser.ts
 *
 * Pure utility module — no NestJS decorators or DI.
 * Two exports:
 *   parseShowdownTeam  — PS export text → lowercase Pokémon name array
 *   formatShowdownTeam — TeamSlot array → PS-importable team text
 */

import type { TournamentLoadout } from '../ml/ml-client.service'

interface ShowdownExportSlot {
  name: string
  loadout?: TournamentLoadout
}

// ---------------------------------------------------------------------------
// Generated team export settings
// ---------------------------------------------------------------------------
const TEAM_SIZE_LIMIT = 6

const NAME_ALIASES: Record<string, string> = {
  'farfetch’d': "farfetch'd",
  'mr mime': 'mr-mime',
  'mr. mime': 'mr-mime',
  'nidoran female': 'nidoran-f',
  'nidoran male': 'nidoran-m',
  'nidoran♀': 'nidoran-f',
  'nidoran♂': 'nidoran-m',
}

export function normalizePokemonName(rawName: string): string {
  const lowerName = rawName.trim().toLowerCase()
  return NAME_ALIASES[lowerName] ?? lowerName.replace(/\s+/g, '-')
}

// ---------------------------------------------------------------------------
// parseShowdownTeam
//
// Accepts Pokémon Showdown export text and returns up to 4 lowercase
// Pokémon names.  Lines that are blank, section headers (===...===), or
// move lines (starting with -) are skipped.  Handles:
//   "Pikachu"              → "pikachu"
//   "Pikachu @ Oran Berry" → "pikachu"
//   "Pikachu (nickname)"   → "pikachu"   (malformed nickname suffix)
// ---------------------------------------------------------------------------
export function parseShowdownTeam(text: string): string[] {
  const names: string[] = []

  for (const rawLine of text.split('\n')) {
    if (names.length >= TEAM_SIZE_LIMIT) break

    const line = rawLine.trim()

    // Skip blank lines
    if (!line) continue

    // Skip section headers  === ... ===
    if (line.startsWith('===')) continue

    // Skip move lines
    if (line.startsWith('-')) continue

    // Skip metadata lines in a full Showdown export block
    if (/^(Ability|EVs|IVs|Level|Gender|Happiness|Tera Type|Shiny):/i.test(line)) continue
    if (/ Nature$/i.test(line)) continue

    // Extract name — stop at '@' (held item) or '(' (nickname prefix)
    const beforeItem = line.split('@', 1)[0].trim()
    const parenthesized = (beforeItem.match(/\(([^)]+)\)/g) ?? [])
      .map((part) => part.slice(1, -1).trim())
      .find((part) => !/^[mf]$/i.test(part))
    const species = parenthesized ?? beforeItem.replace(/\s+\([mf]\)\s*$/i, '')
    const normalized = normalizePokemonName(species)
    if (normalized) names.push(normalized)
  }

  return names
}

// ---------------------------------------------------------------------------
// formatShowdownTeam
//
// Accepts a TeamSlot array (from Engine 1 / ML service) and returns a
// PS-importable tournament team string with loadout details.
// Blank line separates each Pokémon block.
// ---------------------------------------------------------------------------
export function formatShowdownTeam(
  team: ShowdownExportSlot[],
  _theme?: string,
  _difficulty?: string,
): string {
  const blocks: string[] = []

  for (const slot of team) {
    const displayName = slot.name
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('-')
    const loadout = slot.loadout
    if (!loadout) continue

    const lines = [
      `${displayName} @ ${loadout.item}`,
      `Ability: ${loadout.ability}`,
      `EVs: ${loadout.evs}`,
      `${loadout.nature} Nature`,
      `- ${loadout.moves[0]}`,
      `- ${loadout.moves[1]}`,
      `- ${loadout.moves[2]}`,
      `- ${loadout.moves[3]}`,
    ]

    blocks.push(lines.join('\n'))
  }

  return blocks.join('\n\n')
}
