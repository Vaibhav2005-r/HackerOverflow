/** PIN hashing: PBKDF2-SHA256 via WebCrypto, 150k iterations, random salt. Never leaves the device. */
export const PIN_CONFIG = { iterations: 150_000, saltBytes: 16, hashBytes: 32, minLen: 4, maxLen: 6 } as const;

export interface PinHash { salt: string; hash: string; iterations: number }
export type PinResult = "ok" | "duress" | "wrong";

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const isValidPinFormat = (pin: string) => new RegExp(`^[0-9]{${PIN_CONFIG.minLen},${PIN_CONFIG.maxLen}}$`).test(pin);

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt, iterations }, key, PIN_CONFIG.hashBytes * 8);
  return new Uint8Array(bits);
}

export async function hashPin(pin: string, iterations: number = PIN_CONFIG.iterations): Promise<PinHash> {
  if (!isValidPinFormat(pin)) throw new Error("PIN must be 4–6 digits");
  const salt = crypto.getRandomValues(new Uint8Array(PIN_CONFIG.saltBytes));
  return { salt: b64(salt), hash: b64(await derive(pin, salt, iterations)), iterations };
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return d === 0;
}

export async function verifyPin(pin: string, stored: PinHash): Promise<boolean> {
  const got = await derive(pin, unb64(stored.salt), stored.iterations);
  return constantTimeEqual(got, unb64(stored.hash));
}

/** Always evaluates both hashes so timing does not reveal which PIN matched. */
export async function classifyPin(pin: string, normal: PinHash, duress: PinHash): Promise<PinResult> {
  const [isNormal, isDuress] = await Promise.all([verifyPin(pin, normal), verifyPin(pin, duress)]);
  return isNormal ? "ok" : isDuress ? "duress" : "wrong";
}

export function validatePinPair(pin: string, duress: string): "ok" | "invalid" | "same" {
  if (!isValidPinFormat(pin) || !isValidPinFormat(duress)) return "invalid";
  return pin === duress ? "same" : "ok";
}
