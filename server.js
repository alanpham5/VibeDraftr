import "./loadEnv.js";
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import {
  runDraft,
  AI_NAMES,
  PARTICIPANT_MODELS,
  HUMAN_MODEL,
  cleanPlayerName,
  isDuplicate,
} from './src/engine/draft.js';
import {
  loadPlayerRegistry,
  resolvePlayer,
  scoreRoster,
  getRegistryMeta,
} from './src/engine/sportsApi.js';
import { getEnvKeyStatus } from './loadEnv.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

let activeDraft = null;
let sseClients = [];
let pendingHumanPick = null;
let draftState = null;
let draftCancelRequested = false;

function writeSseEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function replayDraftState(res) {
  if (!draftState) return;
  if (draftState.started) writeSseEvent(res, 'started', draftState.started);
  for (const pick of draftState.picks) writeSseEvent(res, 'pick', pick);
  if (draftState.humanTurn) writeSseEvent(res, 'humanTurn', draftState.humanTurn);
}

function waitForHumanPick(context) {
  return new Promise((resolve, reject) => {
    pendingHumanPick = { resolve, reject, context };
    const humanTurn = {
      round: context.round,
      pick: context.pick,
      participantId: context.participantId,
      label: context.label,
      league: context.league,
      takenPlayers: context.allPickedPlayers,
    };
    if (draftState) draftState.humanTurn = humanTurn;
    broadcast('humanTurn', humanTurn);
  });
}

function clearPendingHumanPick(reason) {
  if (pendingHumanPick) {
    pendingHumanPick.reject(new Error(reason));
    pendingHumanPick = null;
  }
  if (draftState) draftState.humanTurn = null;
}

function cancelActiveDraft() {
  if (!activeDraft) return false;
  draftCancelRequested = true;
  clearPendingHumanPick('Draft cancelled');
  draftState = null;
  activeDraft = null;
  broadcast('cancelled', { message: 'Draft cancelled' });
  return true;
}

function clearDraftState() {
  draftState = null;
  clearPendingHumanPick('Draft ended');
  draftCancelRequested = false;
}

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients = sseClients.filter((res) => {
    try {
      res.write(payload);
      return true;
    } catch {
      return false;
    }
  });
}

app.get('/api/status', (req, res) => {
  res.json({ active: !!activeDraft });
});

app.get('/api/draft/state', (req, res) => {
  if (!draftState) {
    return res.json({ active: false });
  }
  res.json({
    active: true,
    started: draftState.started,
    picks: draftState.picks,
    humanTurn: draftState.humanTurn,
  });
});

app.get('/api/sports/players', async (req, res) => {
  const { league } = req.query;
  if (!league || !['NBA', 'NHL'].includes(league)) {
    return res.status(400).json({ error: 'league must be NBA or NHL' });
  }

  try {
    const registry = await loadPlayerRegistry(league);
    res.json({
      ...getRegistryMeta(league),
      players: registry.players,
      byNormalizedName: Object.fromEntries(registry.byNormalizedName),
    });
  } catch (err) {
    res.status(502).json({
      error: err?.message || 'Could not load player stats',
    });
  }
});

app.post('/api/sports/score-roster', async (req, res) => {
  const { league, roster, fantasyScoring } = req.body || {};
  if (!league || !['NBA', 'NHL'].includes(league)) {
    return res.status(400).json({ error: 'league must be NBA or NHL' });
  }
  if (!Array.isArray(roster)) {
    return res.status(400).json({ error: 'roster must be an array' });
  }

  try {
    const result = await scoreRoster(roster, league, fantasyScoring);
    res.json(result);
  } catch (err) {
    res.status(502).json({
      error: err?.message || 'Could not score roster',
    });
  }
});

app.get('/api/env-keys', (req, res) => {
  res.json({
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY,
    XAI_API_KEY: !!process.env.XAI_API_KEY
  });
});

app.get('/api/draft/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.write('\n');
  sseClients.push(res);
  replayDraftState(res);
  req.on('close', () => {
    sseClients = sseClients.filter(c => c !== res);
  });
});

app.post('/api/draft/start', (req, res) => {
  if (activeDraft) return res.status(400).json({ error: 'A draft is already in progress' });

  const {
    league,
    strategy,
    rounds,
    ais,
    participants,
    draftOrder,
    shuffleDraftOrder,
    apiKeys: reqApiKeys,
    fantasyScoring,
    customRules,
  } = req.body;
  if (!league || !['NBA', 'NHL'].includes(league)) {
    return res.status(400).json({ error: 'league must be NBA or NHL' });
  }

  let draftInput;

  if (Array.isArray(participants) && participants.length > 0) {
    if (participants.length < 2) {
      return res.status(400).json({ error: 'Must have at least two draft participants' });
    }
    const invalid = participants.filter(
      (p) => !p?.id || !p?.model || !PARTICIPANT_MODELS.includes(p.model),
    );
    if (invalid.length) {
      return res.status(400).json({ error: 'Each participant needs a valid id and model' });
    }
    draftInput = { participants };
    if (Array.isArray(draftOrder) && draftOrder.length > 0) {
      draftInput.draftOrder = draftOrder;
    }
    if (shuffleDraftOrder === false) {
      draftInput.shuffleDraftOrder = false;
    }
  } else {
    const selectedAis = ais || AI_NAMES;
    if (!Array.isArray(selectedAis) || selectedAis.length < 2) {
      return res.status(400).json({ error: 'Must select at least two AIs for a draft' });
    }
    const invalidAis = selectedAis.filter((ai) => !AI_NAMES.includes(ai));
    if (invalidAis.length) {
      return res.status(400).json({ error: `Invalid AI names: ${invalidAis.join(', ')}` });
    }
    draftInput = { ais: selectedAis };
    if (strategy) draftInput.strategy = strategy;
  }

  const modelsNeeded = draftInput.participants
    ? [
        ...new Set(
          draftInput.participants
            .map((p) => p.model)
            .filter((model) => model !== HUMAN_MODEL),
        ),
      ]
    : draftInput.ais;

  const apiKeysInput = reqApiKeys || {};
  const apiKeys = {
    ANTHROPIC_API_KEY: apiKeysInput.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: apiKeysInput.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
    GOOGLE_API_KEY: apiKeysInput.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY,
    XAI_API_KEY: apiKeysInput.XAI_API_KEY || process.env.XAI_API_KEY
  };

  const aiToKeyName = {
    Claude: 'ANTHROPIC_API_KEY',
    ChatGPT: 'OPENAI_API_KEY',
    Gemini: 'GOOGLE_API_KEY',
    Grok: 'XAI_API_KEY'
  };

  const missing = modelsNeeded
    .map((ai) => aiToKeyName[ai])
    .filter((keyName) => !apiKeys[keyName]);

  if (missing.length) {
    return res.status(400).json({ error: `Missing API keys for selected AIs: ${missing.join(', ')}` });
  }

  const trimmedCustomRules = customRules?.trim() || undefined;

  activeDraft = { status: 'running' };
  draftState = { started: null, picks: [], humanTurn: null };

  const config = {
    league,
    rounds: rounds || 15,
    apiKeys,
    fantasyScoring,
    customRules: trimmedCustomRules,
    ...draftInput,
    onStart: (data) => {
      const started = {
        ...data,
        fantasyScoring: fantasyScoring || null,
        customRules: trimmedCustomRules || null,
      };
      draftState.started = started;
      broadcast('started', started);
    },
    onPick: (data) => {
      draftState.picks.push(data);
      draftState.humanTurn = null;
      broadcast('pick', data);
    },
    onError: (data) => broadcast('error', data),
    onHumanPickNeeded: (context) => waitForHumanPick(context),
    shouldCancel: () => draftCancelRequested,
  };

  (async () => {
    try {
      const result = await runDraft(config);
      if (draftCancelRequested) return;
      const outputDir = path.join(process.cwd(), 'output');
      fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(path.join(outputDir, 'teams.json'), JSON.stringify(result.teams, null, 2));
      fs.writeFileSync(path.join(outputDir, 'draft_log.txt'), result.log.join('\n'));
      broadcast('complete', result);
    } catch (err) {
      if (!draftCancelRequested && err?.message !== 'Draft cancelled') {
        broadcast('error', { message: err.message });
      }
    } finally {
      clearDraftState();
      activeDraft = null;
    }
  })();

  res.json({ message: 'Draft started' });
});

app.post('/api/draft/cancel', (req, res) => {
  cancelActiveDraft();
  res.json({ ok: true });
});

app.post('/api/draft/human-pick', async (req, res) => {
  if (!activeDraft || !pendingHumanPick) {
    return res.status(400).json({ error: 'No human pick is pending' });
  }

  const player = cleanPlayerName(req.body?.player);
  if (!player || player === 'Unknown Player') {
    return res.status(400).json({ error: 'Enter a player name', code: 'INVALID' });
  }

  const { allPickedPlayers, league } = pendingHumanPick.context;
  if (isDuplicate(player, allPickedPlayers)) {
    return res.status(400).json({
      error: `'${player}' is already drafted. Choose someone else.`,
      code: 'DUPLICATE',
    });
  }

  try {
    const registry = await loadPlayerRegistry(league);
    const resolved = await resolvePlayer(player, league, registry);
    if (!resolved) {
      return res.status(422).json({
        error: `Couldn't find "${player}" in ${league}. Check the spelling and try again.`,
        code: 'PLAYER_NOT_FOUND',
      });
    }

    pendingHumanPick.resolve(resolved.name);
    pendingHumanPick = null;
    if (draftState) draftState.humanTurn = null;
    res.json({ ok: true, player: resolved.name });
  } catch (err) {
    res.status(502).json({
      error: err?.message || 'Could not verify player',
      code: 'LOOKUP_FAILED',
    });
  }
});

app.listen(PORT, () => {
  const envKeys = getEnvKeyStatus();
  const loadedCount = Object.values(envKeys).filter(Boolean).length;
  console.log(`Draft server running on http://localhost:${PORT}`);
  console.log(
    `[vibedraftr] Loaded ${loadedCount}/${Object.keys(envKeys).length} API keys from .env`,
  );
});
