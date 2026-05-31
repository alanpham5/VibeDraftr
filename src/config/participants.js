import { AI_LIST, aiHasKey, HUMAN_MODEL } from './aiKeys.js';

export function createParticipant(model, existing = []) {
  const sameModel = existing.filter((p) => p.model === model);
  const num = sameModel.length + 1;
  const id = `${model.toLowerCase().replace(/\s+/g, '')}-${num}-${crypto.randomUUID().slice(0, 6)}`;
  const label = num === 1 ? model : `${model} ${num}`;
  return { id, model, label, strategy: '', customLabel: false };
}

export function buildDefaultParticipants(envKeys, apiKeys) {
  return AI_LIST.filter((model) => aiHasKey(model, envKeys, apiKeys)).map((model) =>
    createParticipant(model, []),
  );
}

export function relabelParticipants(participants) {
  const counts = {};
  return participants.map((p) => {
    if (p.model === HUMAN_MODEL && p.customLabel) {
      return p;
    }
    counts[p.model] = (counts[p.model] || 0) + 1;
    const num = counts[p.model];
    const label = num === 1 ? p.model : `${p.model} ${num}`;
    return { ...p, label, customLabel: false };
  });
}
