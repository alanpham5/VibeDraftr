import { useEffect, useMemo, useState } from "react";
import {
  calculateFantasyPoints,
  normalizeScoringConfig,
} from "../engine/fantasyScoring.js";

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

function findPlayer(name, registry) {
  const normalized = normalizeName(stripPickSuffix(name));
  if (!normalized || !registry?.byNormalizedName) return null;

  const exact = registry.byNormalizedName[normalized];
  if (exact) return exact;

  const candidates = registry.players.filter((player) => {
    const playerName = player.normalizedName;
    return (
      playerName.includes(normalized) ||
      normalized.includes(playerName)
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

export function usePlayerStats(league, scoringConfig) {
  const [registry, setRegistry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const scoring = useMemo(
    () => normalizeScoringConfig(scoringConfig, league),
    [scoringConfig, league],
  );

  useEffect(() => {
    if (!league) {
      setRegistry(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/sports/players?league=${encodeURIComponent(league)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load player stats");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setRegistry({
            ...data,
            season: data.season,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setRegistry(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [league]);

  const resolveRoster = (roster) => {
    if (!Array.isArray(roster) || !registry) {
      return { entries: [], total: 0 };
    }

    const entries = roster.map((pickName) => {
      const player = findPlayer(pickName, registry);
      if (!player) {
        return {
          pickName,
          matched: false,
          fantasyPoints: null,
        };
      }

      return {
        pickName,
        matched: true,
        playerId: player.id,
        name: player.name,
        headshot: player.headshot,
        type: player.type,
        position: player.position,
        fantasyPoints: calculateFantasyPoints(
          player.stats,
          scoring,
          league,
          player.type,
        ),
      };
    });

    const total = entries.reduce(
      (sum, entry) => sum + (entry.fantasyPoints || 0),
      0,
    );

    return {
      entries,
      total: Math.round(total * 10) / 10,
    };
  };

  const resolvePlayer = (pickName) => {
    if (!pickName) {
      return { pickName: "", matched: false, name: "" };
    }

    const { entries } = resolveRoster([pickName]);
    return (
      entries[0] ?? {
        pickName,
        matched: false,
        name: pickName,
        fantasyPoints: null,
      }
    );
  };

  return {
    registry,
    loading,
    error,
    scoring,
    season: registry?.season,
    resolveRoster,
    resolvePlayer,
  };
}
