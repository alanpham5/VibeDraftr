import {
  CURRENT_NBA_SEASON,
  CURRENT_NHL_SEASON_ID,
  calculateFantasyPoints,
  normalizeScoringConfig,
} from "./fantasyScoring.js";

const NHL_SKATER_URL = "https://api.nhle.com/stats/rest/en/skater/summary";
const NHL_GOALIE_URL = "https://api.nhle.com/stats/rest/en/goalie/summary";
const NHL_SEARCH_URL = "https://search.d3.nhle.com/api/v1/search/player";
const NBA_LEADERS_URL = "https://stats.nba.com/stats/leagueLeaders";

const NBA_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};

function formatNhlSeason(seasonId) {
  const value = String(seasonId);
  return `${value.slice(0, 4)}-${value.slice(6, 8)}`;
}

const registryCache = new Map();

function normalizeName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/^error\s*-\s*/i, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripPickSuffix(name) {
  return String(name || "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .trim();
}

function buildNhlHeadshot(playerId, teamAbbrev) {
  const team = String(teamAbbrev || "").split(",")[0].trim();
  if (!playerId || !team) {
    return "https://assets.nhle.com/mugs/nhl/default-skater.png";
  }
  return `https://assets.nhle.com/mugs/nhl/${CURRENT_NHL_SEASON_ID}/${team}/${playerId}.png`;
}

function buildNbaHeadshot(playerId) {
  return `https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${url}`);
  }
  return res.json();
}

async function fetchNhlReport(baseUrl, seasonId) {
  const pageSize = 100;
  let start = 0;
  let total = Infinity;
  const players = [];

  while (start < total) {
    const params = new URLSearchParams({
      cayenneExp: `seasonId=${seasonId} and gameTypeId=2`,
      limit: String(pageSize),
      start: String(start),
      sort: "points",
      dir: "DESC",
    });

    const payload = await fetchJson(`${baseUrl}?${params.toString()}`);
    total = payload.total ?? 0;
    players.push(...(payload.data || []));
    start += pageSize;
    if (!payload.data?.length) break;
  }

  return players;
}

function mapNhlSkater(row) {
  const teamAbbrev = String(row.teamAbbrevs || "").split(",")[0].trim();
  return {
    id: String(row.playerId),
    name: row.skaterFullName,
    normalizedName: normalizeName(row.skaterFullName),
    league: "NHL",
    type: "skater",
    teamAbbrev,
    position: row.positionCode,
    headshot: buildNhlHeadshot(row.playerId, teamAbbrev),
    stats: { ...row },
  };
}

function mapNhlGoalie(row) {
  const teamAbbrev = String(row.teamAbbrevs || "").split(",")[0].trim();
  return {
    id: String(row.playerId),
    name: row.goalieFullName,
    normalizedName: normalizeName(row.goalieFullName),
    league: "NHL",
    type: "goalie",
    teamAbbrev,
    position: "G",
    headshot: buildNhlHeadshot(row.playerId, teamAbbrev),
    stats: { ...row },
  };
}

function mapNbaPlayer(headers, row) {
  const record = {};
  headers.forEach((header, index) => {
    record[header] = row[index];
  });

  const playerId = record.PLAYER_ID;
  const stats = {
    GP: Number(record.GP) || 0,
    MIN: Number(record.MIN) || 0,
    FGM: Number(record.FGM) || 0,
    FGA: Number(record.FGA) || 0,
    FG3M: Number(record.FG3M) || 0,
    FG3A: Number(record.FG3A) || 0,
    FTM: Number(record.FTM) || 0,
    FTA: Number(record.FTA) || 0,
    OREB: Number(record.OREB) || 0,
    DREB: Number(record.DREB) || 0,
    REB: Number(record.REB) || 0,
    AST: Number(record.AST) || 0,
    STL: Number(record.STL) || 0,
    BLK: Number(record.BLK) || 0,
    TOV: Number(record.TOV) || 0,
    PF: Number(record.PF) || 0,
    PTS: Number(record.PTS) || 0,
  };

  return {
    id: String(playerId),
    name: record.PLAYER,
    normalizedName: normalizeName(record.PLAYER),
    league: "NBA",
    type: "player",
    teamAbbrev: record.TEAM,
    position: null,
    headshot: buildNbaHeadshot(playerId),
    stats,
  };
}

async function fetchNbaPlayers() {
  const params = new URLSearchParams({
    LeagueID: "00",
    PerMode: "Totals",
    Scope: "S",
    Season: CURRENT_NBA_SEASON,
    SeasonType: "Regular Season",
    StatCategory: "PTS",
  });

  const payload = await fetchJson(`${NBA_LEADERS_URL}?${params.toString()}`, {
    headers: NBA_HEADERS,
  });

  const { headers, rowSet } = payload.resultSet;
  return rowSet.map((row) => mapNbaPlayer(headers, row));
}

async function fetchNhlPlayers() {
  const [skaters, goalies] = await Promise.all([
    fetchNhlReport(NHL_SKATER_URL, CURRENT_NHL_SEASON_ID),
    fetchNhlReport(NHL_GOALIE_URL, CURRENT_NHL_SEASON_ID),
  ]);

  return [...skaters.map(mapNhlSkater), ...goalies.map(mapNhlGoalie)];
}

function buildRegistry(players) {
  const byNormalizedName = new Map();

  for (const player of players) {
    if (!player.normalizedName) continue;
    const existing = byNormalizedName.get(player.normalizedName);
    if (!existing || player.type === "skater") {
      byNormalizedName.set(player.normalizedName, player);
    }
  }

  return {
    players,
    byNormalizedName,
  };
}

export async function loadPlayerRegistry(league) {
  const cacheKey = league;
  const cached = registryCache.get(cacheKey);
  if (cached && Date.now() - cached.loadedAt < 1000 * 60 * 30) {
    return cached.registry;
  }

  const players =
    league === "NBA" ? await fetchNbaPlayers() : await fetchNhlPlayers();
  const registry = buildRegistry(players);

  registryCache.set(cacheKey, {
    loadedAt: Date.now(),
    registry,
  });

  return registry;
}

function findInRegistry(name, registry) {
  const normalized = normalizeName(stripPickSuffix(name));
  if (!normalized) return null;

  const exact = registry.byNormalizedName.get(normalized);
  if (exact) return exact;

  const candidates = registry.players.filter((player) => {
    const playerName = player.normalizedName;
    return (
      playerName.includes(normalized) ||
      normalized.includes(playerName) ||
      playerName.split(" ").slice(-1)[0] === normalized.split(" ").slice(-1)[0]
    );
  });

  if (candidates.length === 1) return candidates[0];

  const best = candidates
    .map((player) => {
      const playerParts = player.normalizedName.split(" ");
      const queryParts = normalized.split(" ");
      const overlap = playerParts.filter((part) => queryParts.includes(part)).length;
      return { player, overlap };
    })
    .sort((a, b) => b.overlap - a.overlap)[0];

  return best?.overlap >= 2 ? best.player : null;
}

async function searchNhlPlayer(name) {
  const params = new URLSearchParams({
    culture: "en-us",
    limit: "8",
    q: stripPickSuffix(name),
  });
  const results = await fetchJson(`${NHL_SEARCH_URL}?${params.toString()}`);
  const active = (results || []).find((entry) => entry.active);
  if (!active?.playerId) return null;

  const landing = await fetchJson(
    `https://api-web.nhle.com/v1/player/${active.playerId}/landing`,
  );

  const type = landing.position === "G" ? "goalie" : "skater";
  const reportUrl = type === "goalie" ? NHL_GOALIE_URL : NHL_SKATER_URL;
  const statsParams = new URLSearchParams({
    cayenneExp: `seasonId=${CURRENT_NHL_SEASON_ID} and gameTypeId=2 and playerId=${active.playerId}`,
    limit: "1",
  });
  const statsPayload = await fetchJson(`${reportUrl}?${statsParams.toString()}`);
  const row = statsPayload.data?.[0];
  if (!row) return null;

  return type === "goalie" ? mapNhlGoalie(row) : mapNhlSkater(row);
}

export async function resolvePlayer(name, league, registry) {
  const cleaned = stripPickSuffix(name);
  if (!cleaned || /^error/i.test(cleaned)) return null;

  let player = findInRegistry(cleaned, registry);
  if (!player && league === "NHL") {
    player = await searchNhlPlayer(cleaned);
  }
  return player;
}

export async function scoreRoster(names, league, scoringConfig) {
  const registry = await loadPlayerRegistry(league);
  const scoring = normalizeScoringConfig(scoringConfig, league);
  const resolved = [];

  for (const name of names) {
    const player = await resolvePlayer(name, league, registry);
    if (!player) {
      resolved.push({
        pickName: name,
        matched: false,
        fantasyPoints: null,
      });
      continue;
    }

    resolved.push({
      pickName: name,
      matched: true,
      playerId: player.id,
      name: player.name,
      headshot: player.headshot,
      type: player.type,
      fantasyPoints: calculateFantasyPoints(
        player.stats,
        scoring,
        league,
        player.type,
      ),
    });
  }

  const total = resolved.reduce(
    (sum, entry) => sum + (entry.fantasyPoints || 0),
    0,
  );

  return {
    season:
      league === "NBA"
        ? CURRENT_NBA_SEASON
        : formatNhlSeason(CURRENT_NHL_SEASON_ID),
    players: resolved,
    total: Math.round(total * 10) / 10,
  };
}

export function getRegistryMeta(league) {
  return {
    league,
    season:
      league === "NBA"
        ? CURRENT_NBA_SEASON
        : formatNhlSeason(CURRENT_NHL_SEASON_ID),
  };
}
