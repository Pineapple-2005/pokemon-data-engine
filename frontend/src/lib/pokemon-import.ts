const TEAM_SIZE_LIMIT = 6;

const NAME_ALIASES: Record<string, string> = {
  'farfetch’d': "farfetch'd",
  'mr mime': 'mr-mime',
  'mr. mime': 'mr-mime',
  'nidoran female': 'nidoran-f',
  'nidoran male': 'nidoran-m',
  'nidoran♀': 'nidoran-f',
  'nidoran♂': 'nidoran-m',
};

export function normalizeImportedPokemonName(rawName: string): string {
  const lowerName = rawName.trim().toLowerCase();
  return NAME_ALIASES[lowerName] ?? lowerName.replace(/\s+/g, '-');
}

function extractShowdownSpecies(line: string): string {
  const beforeItem = line.split('@', 1)[0].trim();
  const parenthesized = (beforeItem.match(/\(([^)]+)\)/g) ?? [])
    .map((part) => part.slice(1, -1).trim())
    .find((part) => !/^[mf]$/i.test(part));

  return parenthesized ?? beforeItem.replace(/\s+\([mf]\)\s*$/i, '');
}

export function parseShowdownTeam(text: string): string[] {
  const names: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    if (names.length >= TEAM_SIZE_LIMIT) break;

    const line = rawLine.trim();
    if (!line || line.startsWith('-') || line.startsWith('===')) continue;
    if (/^(Ability|EVs|IVs|Level|Gender|Happiness|Tera Type|Shiny):/i.test(line)) continue;
    if (/ Nature$/i.test(line)) continue;

    const name = normalizeImportedPokemonName(extractShowdownSpecies(line));
    if (name) names.push(name);
  }

  return names;
}

function parseCsvRow(row: string): string[] {
  const columns: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < row.length; index++) {
    const char = row[index];
    if (char === '"') {
      if (quoted && row[index + 1] === '"') {
        current += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      columns.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  columns.push(current.trim());
  return columns;
}

export function parsePokemonCsv(text: string): string[] {
  const rows = text.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
  if (rows.length === 0) return [];

  const header = parseCsvRow(rows[0]).map((column) => column.trim().toLowerCase());
  const nameColumn = header.findIndex((column) =>
    ['name', 'pokemon', 'pokemon_name', 'pokemon name'].includes(column),
  );
  const hasHeader = nameColumn !== -1;
  const columnIndex = hasHeader ? nameColumn : 0;

  return rows
    .slice(hasHeader ? 1 : 0)
    .map((row) => normalizeImportedPokemonName(parseCsvRow(row)[columnIndex] ?? ''))
    .filter(Boolean)
    .slice(0, TEAM_SIZE_LIMIT);
}
