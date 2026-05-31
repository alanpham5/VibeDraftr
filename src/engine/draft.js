import aiClients from "./aiClients.js";
import { buildMessages } from "./prompts.js";
import {
  loadPlayerRegistry,
  resolvePlayer,
  getRegistryMeta,
} from "./sportsApi.js";

export const AI_NAMES = ["Claude", "ChatGPT", "Gemini", "Grok"];
export const HUMAN_MODEL = "Human";
export const PARTICIPANT_MODELS = [...AI_NAMES, HUMAN_MODEL];

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function normalizeParticipants(config) {
  if (config.participants?.length) {
    return config.participants.map((p) => ({
      id: p.id,
      model: p.model,
      label: p.label || p.model,
      strategy: p.strategy?.trim() || undefined,
    }));
  }

  const ais = config.ais || AI_NAMES;
  const globalStrategy = config.strategy?.trim() || undefined;
  return ais.map((model, index) => ({
    id: `${model.toLowerCase().replace(/\s+/g, "")}-${index + 1}`,
    model,
    label: model,
    strategy: globalStrategy,
  }));
}

function getNextPick(draftOrder, participantById, rounds, pickNumber) {
  const totalPicks = draftOrder.length;
  const nextPickNumber = pickNumber + 1;
  if (nextPickNumber > rounds * totalPicks) return null;

  const nextRound = Math.ceil(nextPickNumber / totalPicks);
  const posInRound = (nextPickNumber - 1) % totalPicks;
  const orderForRound =
    nextRound % 2 === 1 ? draftOrder : [...draftOrder].reverse();
  const participantId = orderForRound[posInRound];
  const label = participantById.get(participantId)?.label || participantId;
  return {
    round: nextRound,
    pick: nextPickNumber,
    participantId,
    aiName: label,
  };
}

export function cleanPlayerName(raw) {
  if (raw == null || typeof raw !== "string") {
    return "Unknown Player";
  }
  let name = raw.trim();
  if (name.includes("\n")) {
    name = name.split("\n")[0].trim();
  }
  name = name.replace(/^["'.-]+|["'.-]+$/g, "").trim();
  return name;
}

export class DraftCancelledError extends Error {
  constructor() {
    super("Draft cancelled");
    this.name = "DraftCancelledError";
  }
}

function isDraftCancelled(err) {
  return (
    err instanceof DraftCancelledError || err?.message === "Draft cancelled"
  );
}

export function isDuplicate(player, allPicked) {
  return allPicked.some((p) => p.toLowerCase() === player.toLowerCase());
}

async function requestAiPlayerPick(apiKey, model, messages, allPicked) {
  let response = await aiClients[model](apiKey, messages);
  let player = cleanPlayerName(response);

  let retries = 0;
  while (isDuplicate(player, allPicked) && retries < 3) {
    retries++;
    messages.push({
      role: "assistant",
      content: player,
    });
    messages.push({
      role: "user",
      content: `'${player}' is already drafted. Pick a DIFFERENT player. Already taken: ${allPicked.join(", ")}`,
    });
    response = await aiClients[model](apiKey, messages);
    player = cleanPlayerName(response);
  }

  if (isDuplicate(player, allPicked)) {
    player = `${player} (invalid pick)`;
  }

  return player;
}

function isRetryableAiPick(player) {
  return (
    player &&
    !player.includes("(invalid pick)") &&
    !/^error/i.test(player)
  );
}

function resolveDraftOrder(participants, config) {
  const participantIds = participants.map((p) => p.id);
  const shuffleDraftOrder = config.shuffleDraftOrder !== false;

  if (shuffleDraftOrder) {
    return shuffle(participantIds);
  }

  if (Array.isArray(config.draftOrder) && config.draftOrder.length > 0) {
    const idSet = new Set(participantIds);
    const ordered = config.draftOrder.filter((id) => idSet.has(id));
    const missing = participantIds.filter((id) => !ordered.includes(id));
    if (ordered.length + missing.length === participantIds.length) {
      return [...ordered, ...missing];
    }
  }

  return participantIds;
}

export async function runDraft(config) {
  const { league, apiKeys, onPick, onError, onStart, onHumanPickNeeded } =
    config;
  const rounds = config.rounds || 10;
  const customRules = config.customRules?.trim() || undefined;

  const participants = normalizeParticipants(config);
  const draftOrder = resolveDraftOrder(participants, config);
  const participantById = new Map(participants.map((p) => [p.id, p]));

  if (onStart) {
    onStart({
      draftOrder,
      league,
      rounds,
      customRules,
      participants: participants.map(({ id, model, label, strategy }) => ({
        id,
        model,
        label,
        strategy,
      })),
    });
  }

  const teams = {};
  participants.forEach((p) => {
    teams[p.id] = [];
  });
  const allPicked = [];
  let pickNumber = 0;
  const log = [];

  const keyMap = {
    Claude: apiKeys.ANTHROPIC_API_KEY,
    ChatGPT: apiKeys.OPENAI_API_KEY,
    Gemini: apiKeys.GOOGLE_API_KEY,
    Grok: apiKeys.XAI_API_KEY,
  };

  const registry = await loadPlayerRegistry(league);
  const { season } = getRegistryMeta(league);

  for (let round = 1; round <= rounds; round++) {
    const order = round % 2 === 1 ? [...draftOrder] : [...draftOrder].reverse();

    for (const participantId of order) {
      if (config.shouldCancel?.()) {
        throw new DraftCancelledError();
      }

      const participant = participantById.get(participantId);
      const { model, label, strategy } = participant;
      pickNumber++;
      let player;

      try {
        if (model === HUMAN_MODEL) {
          if (!onHumanPickNeeded) {
            throw new Error("Human picks require the web UI");
          }
          player = cleanPlayerName(
            await onHumanPickNeeded({
              round,
              pick: pickNumber,
              participantId,
              label,
              league,
              allPickedPlayers: [...allPicked],
            }),
          );
          if (isDuplicate(player, allPicked)) {
            player = `${player} (invalid pick)`;
          }
        } else {
          const messages = buildMessages({
            league,
            aiName: label,
            round,
            pick: pickNumber,
            totalRounds: rounds,
            rosterSoFar: teams[participantId],
            allPickedPlayers: allPicked,
            strategy,
            customRules,
          });

          const apiKey = keyMap[model];
          player = await requestAiPlayerPick(
            apiKey,
            model,
            messages,
            allPicked,
          );

          let mulliganUsed = false;
          while (isRetryableAiPick(player)) {
            const resolved = await resolvePlayer(player, league, registry);
            if (resolved || mulliganUsed) break;

            mulliganUsed = true;
            messages.push({
              role: "assistant",
              content: player,
            });
            messages.push({
              role: "user",
              content: `'${player}' did not play in the current ${league} season (${season}; injury, retirement, etc.). Pick a DIFFERENT player who is active this season. Already taken: ${allPicked.join(", ")}`,
            });
            player = await requestAiPlayerPick(
              apiKey,
              model,
              messages,
              allPicked,
            );
          }
        }
      } catch (err) {
        if (isDraftCancelled(err)) throw err;
        if (onError) {
          onError({
            round,
            pick: pickNumber,
            participantId,
            aiName: label,
            model,
            message: err?.message || String(err),
          });
        }
        player = `ERROR - ${label} pick failed`;
      }

      teams[participantId].push(player);
      allPicked.push(player);

      if (onPick) {
        onPick({
          round,
          pick: pickNumber,
          participantId,
          model,
          label,
          aiName: label,
          player,
          rosterSoFar: [...teams[participantId]],
          nextPick: getNextPick(draftOrder, participantById, rounds, pickNumber),
        });
      }

      log.push(
        `Pick #${pickNumber} (Round ${round}): ${label} selects ${player}`,
      );
    }
  }

  return { teams, draftOrder, participants, log, league };
}
