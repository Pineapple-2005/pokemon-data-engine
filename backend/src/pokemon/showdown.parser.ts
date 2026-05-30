/**
 * showdown.parser.ts
 *
 * Pure utility module — no NestJS decorators or DI.
 * Two exports:
 *   parseShowdownTeam  — PS export text → lowercase Pokémon name array
 *   formatShowdownTeam — TeamSlot array → PS-importable team text
 */

import type { TeamSlot } from '../ml/ml-client.service'

// ---------------------------------------------------------------------------
// Role → canonical Gen 1 move set mapping
// ---------------------------------------------------------------------------
const ROLE_MOVES: Record<string, [string, string, string, string]> = {
  sweeper:  ['Hyper Beam',    'Body Slam',    'Earthquake',    'Swords Dance'],
  tank:     ['Body Slam',     'Earthquake',   'Rock Slide',    'Rest'],
  wall:     ['Rest',          'Toxic',        'Thunder Wave',  'Body Slam'],
  support:  ['Thunder Wave',  'Soft-Boiled',  'Seismic Toss',  'Rest'],
  balanced: ['Body Slam',     'Earthquake',   'Ice Beam',      'Thunderbolt'],
}

const DEFAULT_MOVES: [string, string, string, string] = ['Body Slam', 'Earthquake', 'Ice Beam', 'Thunderbolt']

// ---------------------------------------------------------------------------
// parseShowdownTeam
//
// Accepts Pokémon Showdown export text and returns up to 6 lowercase
// Pokémon names.  Lines that are blank, section headers (===...===), or
// move lines (starting with -) are skipped.  Handles:
//   "Pikachu"              → "pikachu"
//   "Pikachu @ Oran Berry" → "pikachu"
//   "Pikachu (nickname)"   → "pikachu"   (malformed nickname suffix)
// ---------------------------------------------------------------------------
export function parseShowdownTeam(text: string): string[] {
  const names: string[] = []

  for (const rawLine of text.split('\n')) {
    if (names.length >= 6) break

    const line = rawLine.trim()

    // Skip blank lines
    if (!line) continue

    // Skip section headers  === ... ===
    if (line.startsWith('===')) continue

    // Skip move lines
    if (line.startsWith('-')) continue

    // Extract name — stop at '@' (held item) or '(' (nickname prefix)
    let name = line
    const atIdx = name.indexOf('@')
    if (atIdx !== -1) name = name.slice(0, atIdx)

    const parenIdx = name.indexOf('(')
    if (parenIdx !== -1) name = name.slice(0, parenIdx)

    const normalized = name.trim().toLowerCase()
    if (normalized) names.push(normalized)
  }

  return names
}

// ---------------------------------------------------------------------------
// formatShowdownTeam
//
// Accepts a TeamSlot array (from Engine 1 / ML service) and returns a
// PS-importable Gen 1 team string.  No held items (Gen 1 has none).
// Blank line separates each Pokémon block.
// ---------------------------------------------------------------------------
export function formatShowdownTeam(
  team: TeamSlot[],
  _theme?: string,
  _difficulty?: string,
): string {
  const blocks: string[] = []

  for (const slot of team) {
    const displayName = slot.name.charAt(0).toUpperCase() + slot.name.slice(1)

    const moves = ROLE_MOVES[slot.role.toLowerCase()] ?? DEFAULT_MOVES

    const lines = [
      displayName,
      `- ${moves[0]}`,
      `- ${moves[1]}`,
      `- ${moves[2]}`,
      `- ${moves[3]}`,
    ]

    blocks.push(lines.join('\n'))
  }

  return blocks.join('\n\n')
}
