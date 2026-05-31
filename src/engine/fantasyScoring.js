export const CURRENT_NBA_SEASON = "2025-26";
export const CURRENT_NHL_SEASON_ID = 20252026;

export const NBA_STAT_OPTIONS = [
  { key: "PTS", label: "Points" },
  { key: "REB", label: "Rebounds" },
  { key: "AST", label: "Assists" },
  { key: "STL", label: "Steals" },
  { key: "BLK", label: "Blocks" },
  { key: "TOV", label: "Turnovers" },
  { key: "FG3M", label: "3-Pointers Made" },
  { key: "FGM", label: "Field Goals Made" },
  { key: "FGA", label: "Field Goals Attempted" },
  { key: "FTM", label: "Free Throws Made" },
  { key: "OREB", label: "Offensive Rebounds" },
  { key: "DREB", label: "Defensive Rebounds" },
  { key: "PF", label: "Personal Fouls" },
  { key: "GP", label: "Games Played" },
  { key: "MIN", label: "Minutes" },
];

export const NHL_SKATER_STAT_OPTIONS = [
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
  { key: "points", label: "Points" },
  { key: "plusMinus", label: "Plus/Minus" },
  { key: "penaltyMinutes", label: "Penalty Minutes" },
  { key: "shots", label: "Shots" },
  { key: "ppGoals", label: "Power Play Goals" },
  { key: "ppPoints", label: "Power Play Points" },
  { key: "shGoals", label: "Short-Handed Goals" },
  { key: "shPoints", label: "Short-Handed Points" },
  { key: "gameWinningGoals", label: "Game-Winning Goals" },
  { key: "evGoals", label: "Even-Strength Goals" },
  { key: "evPoints", label: "Even-Strength Points" },
  { key: "gamesPlayed", label: "Games Played" },
];

export const NHL_GOALIE_STAT_OPTIONS = [
  { key: "wins", label: "Wins" },
  { key: "losses", label: "Losses" },
  { key: "saves", label: "Saves" },
  { key: "shutouts", label: "Shutouts" },
  { key: "goalsAgainst", label: "Goals Against" },
  { key: "savePct", label: "Save %" },
  { key: "goalsAgainstAverage", label: "GAA" },
  { key: "gamesPlayed", label: "Games Played" },
];

export const DEFAULT_NBA_TERMS = [
  { stat: "PTS", coefficient: 1 },
  { stat: "REB", coefficient: 1.25 },
  { stat: "AST", coefficient: 1.5 },
  { stat: "STL", coefficient: 2 },
  { stat: "BLK", coefficient: 2 },
  { stat: "TOV", coefficient: -0.5 },
  { stat: "FG3M", coefficient: 0.5 },
];

export const DEFAULT_NHL_SKATER_TERMS = [
  { stat: "goals", coefficient: 3 },
  { stat: "assists", coefficient: 2 },
  { stat: "shots", coefficient: 0.4 },
  { stat: "plusMinus", coefficient: 0.5 },
  { stat: "penaltyMinutes", coefficient: -0.25 },
  { stat: "ppPoints", coefficient: 0.5 },
  { stat: "gameWinningGoals", coefficient: 1 },
];

export const DEFAULT_NHL_GOALIE_TERMS = [
  { stat: "wins", coefficient: 4 },
  { stat: "saves", coefficient: 0.08 },
  { stat: "shutouts", coefficient: 3 },
  { stat: "goalsAgainst", coefficient: -1 },
];

export function getStatOptionsForLeague(league) {
  if (league === "NBA") return NBA_STAT_OPTIONS;
  return NHL_SKATER_STAT_OPTIONS;
}

export function getDefaultTermsForLeague(league) {
  if (league === "NBA") return DEFAULT_NBA_TERMS;
  return DEFAULT_NHL_SKATER_TERMS;
}

export function formatNhlGoalieScoringSummary() {
  const labels = Object.fromEntries(
    NHL_GOALIE_STAT_OPTIONS.map((option) => [option.key, option.label]),
  );
  return DEFAULT_NHL_GOALIE_TERMS.map(
    ({ stat, coefficient }) => `${labels[stat] || stat} × ${coefficient}`,
  ).join(", ");
}

export function createDefaultScoringConfig(league) {
  return {
    useCustom: false,
    terms: getDefaultTermsForLeague(league).map((term) => ({ ...term })),
  };
}

export function normalizeScoringConfig(config, league) {
  const defaults = createDefaultScoringConfig(league);
  if (!config || typeof config !== "object") return defaults;

  const validStats = new Set(
    getStatOptionsForLeague(league).map((option) => option.key),
  );

  const terms = Array.isArray(config.terms)
    ? config.terms
        .filter((term) => term?.stat && Number.isFinite(Number(term.coefficient)))
        .filter((term) => validStats.has(String(term.stat)))
        .map((term) => ({
          stat: String(term.stat),
          coefficient: Number(term.coefficient),
        }))
    : defaults.terms;

  return {
    useCustom: !!config.useCustom,
    terms: terms.length ? terms : defaults.terms,
  };
}

function getTermsForPlayer(scoringConfig, league, playerType) {
  if (league === "NBA") {
    if (!scoringConfig?.useCustom) return DEFAULT_NBA_TERMS;
    return scoringConfig.terms;
  }

  if (playerType === "goalie") {
    return DEFAULT_NHL_GOALIE_TERMS;
  }

  if (!scoringConfig?.useCustom) {
    return DEFAULT_NHL_SKATER_TERMS;
  }

  return scoringConfig.terms;
}

export function calculateFantasyPoints(stats, scoringConfig, league, playerType = "skater") {
  if (!stats) return null;

  const terms = getTermsForPlayer(scoringConfig, league, playerType);
  let total = 0;

  for (const { stat, coefficient } of terms) {
    const value = Number(stats[stat]);
    if (Number.isFinite(value)) {
      total += value * coefficient;
    }
  }

  return Math.round(total * 10) / 10;
}

export function formatFantasyPoints(points) {
  if (points == null || Number.isNaN(points)) return "—";
  return Number.isInteger(points) ? String(points) : points.toFixed(1);
}
