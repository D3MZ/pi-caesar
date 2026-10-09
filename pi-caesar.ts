import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { discoverCiphers, encryptText, readSettings } from "./ciphers.ts";

export default (pi: ExtensionAPI) => {
  // Pi can retain native dependencies across /reload; refresh the package entry.
  const require = createRequire(import.meta.url);
  delete require.cache[require.resolve("cipherts")];
  const ciphers = discoverCiphers(require("cipherts"));
  let settings = readSettings(JSON.parse(readFileSync(new URL("./config.json", import.meta.url), "utf8")), ciphers);

  pi.registerCommand("cipher", {
    description: "Select an exported cipher and its JSON arguments",
    getArgumentCompletions: prefix => [...ciphers.keys()]
      .filter(name => name.startsWith(prefix))
      .map(name => ({ value: name, label: name })),
    handler: async (raw, ctx) => {
      try {
        const match = /^(\S+)(?:\s+([\s\S]+))?$/.exec(raw.trim());
        let name = match?.[1];
        let options = match?.[2];
        if (!name) {
          if (!ctx.hasUI) {
            ctx.ui.notify(`Current: ${settings.cipher}. Available: ${[...ciphers.keys()].join(", ")}. Use /cipher <name> <JSON args array>.`, "info");
            return;
          }
          name = await ctx.ui.select(`Cipher (current: ${settings.cipher})`, [...ciphers.keys()]);
          if (!name) return;
        }
        if (!ciphers.has(name)) throw new Error(`Unknown cipher: ${name}`);
        if (options === undefined) {
          if (!ctx.hasUI) throw new Error("Usage: /cipher <name> <JSON args array>");
          const defaults = JSON.stringify(name === settings.cipher ? settings.args : []);
          options = await ctx.ui.input(`Arguments after plaintext for ${name} (JSON array; blank uses ${defaults})`, defaults);
          if (options === undefined) return;
          if (!options.trim()) options = defaults;
        }
        const parsed: unknown = JSON.parse(options);
        if (!parsed || typeof parsed !== "object") throw new Error("Use a JSON args array or an object with args and format");
        const config = Array.isArray(parsed) ? { args: parsed } : parsed;
        settings = readSettings({ format: settings.format, ...config, cipher: name }, ciphers);
        ctx.ui.notify(`Cipher: ${settings.cipher}`, "info");
      } catch (error) {
        ctx.ui.notify(`Pi Caesar: ${error instanceof Error ? error.message : String(error)}`, "error");
      }
    },
  });

  pi.on("input", async ({ text, images }, ctx) => {
    try {
      return { action: "transform", text: await encryptText(text, settings, ciphers), images };
    } catch (error) {
      // Pi continues with the original input if an input handler throws. Stop it instead.
      ctx.ui.notify(`Pi Caesar: encryption failed; input was not sent. ${error instanceof Error ? error.message : String(error)}`, "error");
      return { action: "handled" };
    }
  });
};
