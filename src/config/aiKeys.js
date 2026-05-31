export const AI_KEY_MAP = {
  Claude: 'ANTHROPIC_API_KEY',
  ChatGPT: 'OPENAI_API_KEY',
  Gemini: 'GOOGLE_API_KEY',
  Grok: 'XAI_API_KEY',
};

export const AI_LIST = ['Claude', 'ChatGPT', 'Gemini', 'Grok'];
export const HUMAN_MODEL = 'Human';

export const KEY_FIELDS = [
  {
    key: 'ANTHROPIC_API_KEY',
    ai: 'Claude',
    label: 'Claude API Key (Anthropic)',
    placeholder: 'x-api-key',
  },
  {
    key: 'OPENAI_API_KEY',
    ai: 'ChatGPT',
    label: 'ChatGPT API Key (OpenAI)',
    placeholder: 'sk-...',
  },
  {
    key: 'GOOGLE_API_KEY',
    ai: 'Gemini',
    label: 'Gemini API Key (Google)',
    placeholder: 'AIzaSy...',
  },
  {
    key: 'XAI_API_KEY',
    ai: 'Grok',
    label: 'Grok API Key (xAI)',
    placeholder: 'xai-...',
  },
];

export function loadStoredApiKeys() {
  return {
    ANTHROPIC_API_KEY: localStorage.getItem('vd_anthropic_api_key') || '',
    OPENAI_API_KEY: localStorage.getItem('vd_openai_api_key') || '',
    GOOGLE_API_KEY: localStorage.getItem('vd_google_api_key') || '',
    XAI_API_KEY: localStorage.getItem('vd_xai_api_key') || '',
  };
}

export function saveApiKey(key, value) {
  localStorage.setItem(`vd_${key.toLowerCase()}`, value);
}

export function hasApiKey(keyName, envKeys, apiKeys) {
  return !!(envKeys[keyName] || apiKeys[keyName]?.trim());
}

export function aiHasKey(aiName, envKeys, apiKeys) {
  return hasApiKey(AI_KEY_MAP[aiName], envKeys, apiKeys);
}

export function needsCredentialsStep(envKeys) {
  return KEY_FIELDS.some(({ key }) => !envKeys[key]);
}

export function getMissingEnvKeyFields(envKeys) {
  return KEY_FIELDS.filter(({ key }) => !envKeys[key]);
}
