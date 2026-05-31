export function getPlayerProfileUrl(league, entry, season) {
  if (!entry?.matched) return null;

  if (league === "NBA" && entry.playerId) {
    return `https://full-court-focus.vercel.app/players/${entry.playerId}`;
  }

  if (league === "NHL" && entry.name) {
    const params = new URLSearchParams();
    params.set("player", entry.name);
    params.set("season", season ? String(season).split("-")[0] : "2025");
    params.set(
      "position",
      entry.position || (entry.type === "goalie" ? "G" : "F"),
    );
    return `https://blue-line-breakdown.vercel.app/?${params.toString()}`;
  }

  return null;
}
