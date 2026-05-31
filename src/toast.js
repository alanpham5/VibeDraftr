import { toast } from 'react-toastify';

function formatErrorMessage(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && typeof value.message === 'string') return value.message;
  return null;
}

function toFriendlyMessage(raw, aiName) {
  const msg = raw || (aiName ? `${aiName} pick failed` : 'Something went wrong');
  const lower = msg.toLowerCase();

  if (
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('rate_limit') ||
    lower.includes('too many requests') ||
    lower.includes('quota')
  ) {
    return aiName
      ? `${aiName} is rate limited — skipping this pick and continuing the draft.`
      : 'An AI is rate limited — skipping this pick and continuing the draft.';
  }

  if (msg.length > 180) {
    return `${msg.slice(0, 180)}…`;
  }

  return msg;
}

export function showDraftError(data) {
  const raw =
    formatErrorMessage(data?.message) ||
    formatErrorMessage(data?.error) ||
    null;

  toast.warn(toFriendlyMessage(raw, data?.aiName), {
    autoClose: 6000,
  });
}

export function showError(message) {
  toast.error(toFriendlyMessage(message), { autoClose: 6000 });
}
