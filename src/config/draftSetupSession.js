import { aiHasKey, HUMAN_MODEL } from "./aiKeys.js";
import { buildDefaultParticipants } from "./participants.js";
import { normalizeScoringConfig } from "../engine/fantasyScoring.js";

export const DEFAULT_DRAFT_ROUNDS = 5;
const SESSION_KEY = "vibedraftr-draft-setup";

export function loadDraftSetupSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;

    const league = data.league === "NHL" ? "NHL" : "NBA";
    const parsedRounds = parseInt(data.rounds, 10);
    const rounds = Number.isFinite(parsedRounds)
      ? Math.max(1, Math.min(30, parsedRounds))
      : DEFAULT_DRAFT_ROUNDS;

    return {
      league,
      rounds,
      shuffleOrder: data.shuffleOrder !== false,
      customRules: typeof data.customRules === "string" ? data.customRules : "",
      fantasyScoring: data.fantasyScoring,
      participants: Array.isArray(data.participants) ? data.participants : null,
    };
  } catch {
    return null;
  }
}

export function saveDraftSetupSession({
  league,
  rounds,
  shuffleOrder,
  customRules,
  fantasyScoring,
  participants,
}) {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        league,
        rounds,
        shuffleOrder,
        customRules,
        fantasyScoring,
        participants: participants.map(
          ({ id, model, label, strategy, customLabel }) => ({
            id,
            model,
            label,
            strategy,
            customLabel: !!customLabel,
          }),
        ),
      }),
    );
  } catch {
    // Ignore quota or private-mode storage errors.
  }
}

export function restoreParticipants(savedParticipants, envKeys, apiKeys) {
  if (!Array.isArray(savedParticipants) || savedParticipants.length === 0) {
    return buildDefaultParticipants(envKeys, apiKeys);
  }

  const restored = savedParticipants
    .filter((p) => p?.id && p?.model)
    .filter(
      (p) => p.model === HUMAN_MODEL || aiHasKey(p.model, envKeys, apiKeys),
    )
    .map((p) => ({
      id: p.id,
      model: p.model,
      label: String(p.label ?? p.model),
      strategy: String(p.strategy ?? ""),
      customLabel: !!p.customLabel,
    }));

  return restored.length >= 2
    ? restored
    : buildDefaultParticipants(envKeys, apiKeys);
}

export function getInitialDraftSetup() {
  const saved = loadDraftSetupSession();
  const league = saved?.league ?? "NBA";

  return {
    league,
    rounds: saved?.rounds ?? DEFAULT_DRAFT_ROUNDS,
    shuffleOrder: saved?.shuffleOrder ?? true,
    customRules: saved?.customRules ?? "",
    fantasyScoring: saved?.fantasyScoring
      ? normalizeScoringConfig(saved.fantasyScoring, league)
      : null,
    participants: saved?.participants ?? null,
  };
}
