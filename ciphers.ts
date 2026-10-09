export type Cipher = (text: string, ...args: unknown[]) => unknown;
export type CipherSettings = {
  cipher: string;
  args: unknown[];
  format: "preserve" | "compact";
};

// Discover the package's public encryption interfaces, including future exports.
export function discoverCiphers(exports: Record<string, unknown>): Map<string, Cipher> {
  const ciphers = new Map<string, Cipher>();
  for (const [name, value] of Object.entries(exports).sort(([a], [b]) => a.localeCompare(b))) {
    if (value === null || (typeof value !== "object" && typeof value !== "function")) continue;
    const encrypt = (value as { encrypt?: unknown }).encrypt;
    if (typeof encrypt === "function") {
      ciphers.set(name, (text, ...args) => Reflect.apply(encrypt, value, [text, ...args]));
    }
  }
  return ciphers;
}

export function readSettings(raw: unknown, ciphers: Map<string, Cipher>): CipherSettings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Config must be a JSON object");
  }
  const config = raw as Record<string, unknown>;
  let defaults = [3];
  // Keep the original config.json shift format working, including negative/wrapped shifts.
  if ("shift" in config) {
    if ("cipher" in config || "args" in config || !Number.isInteger(config.shift)) {
      throw new Error("Legacy shift must be an integer; use cipher and args for the new config");
    }
    defaults = [(((config.shift as number) % 26) + 26) % 26];
  }
  const cipher = "cipher" in config ? config.cipher : "caesar";
  const args = "args" in config ? config.args : ("cipher" in config ? [] : defaults);
  const format = "format" in config ? config.format : "preserve";
  if (typeof cipher !== "string" || !ciphers.has(cipher)) {
    throw new Error(`Unknown cipher. Available: ${[...ciphers.keys()].join(", ")}`);
  }
  if (!Array.isArray(args)) throw new Error("args must be a JSON array in encrypt argument order");
  if (format !== "preserve" && format !== "compact") {
    throw new Error('format must be "preserve" or "compact"');
  }
  return { cipher, args, format };
}

export async function encryptText(
  text: string,
  settings: CipherSettings,
  ciphers: Map<string, Cipher>,
): Promise<string> {
  const encrypt = ciphers.get(settings.cipher);
  if (!encrypt) throw new Error(`Cipher unavailable: ${settings.cipher}`);
  // cipherTS accepts only letters/whitespace and normalizes to lowercase letters.
  const letters = (text.match(/[A-Za-z]/g) ?? []).join("").toLowerCase();
  if (!letters) return text;
  const result = await encrypt(letters, ...settings.args);
  if (typeof result !== "string" || !result) throw new Error("Cipher returned no ciphertext string");
  // Reinsert the original layout only when output has one letter per input letter.
  if (settings.format === "compact" || result.length !== letters.length || !/^[A-Za-z]+$/.test(result)) {
    return result;
  }
  let index = 0;
  return text.replace(/[A-Za-z]/g, letter => {
    const encrypted = result[index++];
    return letter === letter.toUpperCase() ? encrypted.toUpperCase() : encrypted.toLowerCase();
  });
}
