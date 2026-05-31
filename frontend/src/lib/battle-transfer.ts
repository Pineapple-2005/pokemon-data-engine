const TEAM_SIZE_LIMIT = 4;

interface BattlePredictorDraft {
  battlerA?: string;
  teamA?: string[];
  teamB?: string[];
}

function padTeam(names: string[]): string[] {
  const team = names.slice(0, TEAM_SIZE_LIMIT);
  while (team.length < TEAM_SIZE_LIMIT) team.push('');
  return team;
}

export function storeBattlePredictorDraft(draft: BattlePredictorDraft) {
  if (draft.battlerA !== undefined) {
    sessionStorage.setItem('engine3.battlerA', JSON.stringify(draft.battlerA));
  }
  if (draft.teamA !== undefined) {
    sessionStorage.setItem('engine3.teamA', JSON.stringify(padTeam(draft.teamA)));
  }
  if (draft.teamB !== undefined) {
    sessionStorage.setItem('engine3.teamB', JSON.stringify(padTeam(draft.teamB)));
  }

  sessionStorage.setItem('engine3.prediction', 'null');
  sessionStorage.setItem('engine3.currentMatchId', JSON.stringify(''));
  sessionStorage.setItem('engine3.actualWinner', JSON.stringify(''));
  sessionStorage.setItem('engine3.replayLink', JSON.stringify(''));
  sessionStorage.setItem('engine3.screenshotLink', JSON.stringify(''));
  sessionStorage.setItem('engine3.finalScore', JSON.stringify(''));
  sessionStorage.setItem('engine3.recorded', 'false');
}
