import * as Crypto from 'expo-crypto';

/** uuid v4 — stable across export/import, used as the habits primary key. */
export function generateId(): string {
  return Crypto.randomUUID();
}
