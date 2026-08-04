import type { MotivationMessage } from './messages';
import { MOTIVATION_MESSAGES } from './messages';

const STORAGE_KEY = 'bahrawy.motivation.last';

export function pickMotivationMessage(): MotivationMessage {
  const count = MOTIVATION_MESSAGES.length;
  let previousIndex = -1;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) previousIndex = Number.parseInt(stored, 10);
  } catch {
    // localStorage unavailable — fall back to plain random pick.
  }

  let index = -1;
  if (count > 1) {
    do {
      index = Math.floor(Math.random() * count);
    } while (index === previousIndex);
  } else {
    index = 0;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, String(index));
  } catch {
    // Ignore storage failures; the banner still works without persistence.
  }

  return MOTIVATION_MESSAGES[index];
}
