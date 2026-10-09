import assert from "node:assert/strict";
import test from "node:test";
import * as cipherTS from "cipherts";
import { discoverCiphers, encryptText, readSettings } from "../ciphers.ts";
import extension from "../pi-caesar.ts";

const ciphers = discoverCiphers(cipherTS);
const settings = (cipher, args, format = "preserve") => readSettings({ cipher, args, format }, ciphers);

test("discovers real exports and future encryption interfaces without a name list", async () => {
  const options = { salt: 7 };
  let received;
  const future = {
    marker: "ok",
    encrypt(text, key, opts, ...rest) {
      received = [this.marker, text, key, opts, rest];
      return "xyz";
    },
  };
  const expanded = discoverCiphers({ ...cipherTS, futureCipher: future, helper: null, decryptOnly: { decrypt() {} } });
  assert.equal(ciphers.size, Object.values(cipherTS).filter(value => typeof value?.encrypt === "function").length);
  assert.equal(expanded.size, ciphers.size + 1);
  assert.equal(await encryptText("Abc!", readSettings({ cipher: "futureCipher", args: ["key", options, 9], format: "compact" }, expanded), expanded), "xyz");
  assert.deepEqual(received, ["ok", "abc", "key", options, [9]]);
  assert.equal(received[3], options);
});

test("all 11 inspected package APIs encrypt with their different signatures", async () => {
  // These are verification vectors, not the selectable production inventory.
  const vectors = {
    affine: [[5, 8], "izzisgizxiov"],
    atbash: [[], "zggzxpzgwzdm"],
    autokey: [["key"], "kxravdavnapq"],
    beaufort: [["key"], "klfkcoklvkil"],
    caesar: [[3], "dwwdfndwgdzq"],
    columnarTransposition: [["key"], "tctwaaaatkdn"],
    polybiusSquare: [[], "114444111325114414115233"],
    railFence: [[3], "acdtaktantaw"],
    rot13: [[], "nggnpxngqnja"],
    substitution: [["keyword"], "kqqkyfkqwkui"],
    vigenere: [["key"], "kxrkgikxbkal"],
  };
  for (const [name, [args, expected]] of Object.entries(vectors)) {
    assert.ok(ciphers.has(name), name);
    assert.equal(await encryptText("Attack at dawn!", settings(name, args, "compact"), ciphers), expected, name);
    assert.equal(cipherTS[name].encrypt("attackatdawn", ...args), expected, name);
  }
});

test("Caesar retains original case, punctuation, nonletters and legacy shift wrapping", async () => {
  const text = "Az-Zz! 123\nCafé 🙂";
  for (const shift of [-53, -3, 0, 3, 26, 53]) {
    const offset = ((shift % 26) + 26) % 26;
    const expected = text.replace(/[A-Za-z]/g, char => {
      const base = char <= "Z" ? 65 : 97;
      return String.fromCharCode(base + ((char.charCodeAt(0) - base + offset) % 26));
    });
    assert.equal(await encryptText(text, readSettings({ shift }, ciphers), ciphers), expected);
  }
  assert.equal(await encryptText(text, readSettings({}, ciphers), ciphers), "Dc-Cc! 123\nFdié 🙂");
  assert.equal(await encryptText("123 🙂", settings("caesar", [3]), ciphers), "123 🙂");
});

test("formatting keeps letter layouts and falls back to compact expanding output", async () => {
  assert.equal(await encryptText("Attack at dawn!", settings("vigenere", ["KEY"]), ciphers), "Kxrkgi kx bkal!");
  assert.equal(await encryptText("Attack at dawn!", settings("railFence", [3]), ciphers), "Acdtak ta ntaw!");
  assert.equal(await encryptText("Jig! 42", settings("polybiusSquare", []), ciphers), "242422");
  assert.equal(await encryptText("Jig! 42", settings("rot13", [], "compact"), ciphers), "wvt");
  assert.equal(await encryptText("", settings("autokey", ["key"]), ciphers), "");
});

function harness() {
  let command, input;
  const notices = [];
  extension({ registerCommand(name, value) { assert.equal(name, "cipher"); command = value; }, on(name, handler) { assert.equal(name, "input"); input = handler; } });
  const ctx = { hasUI: false, ui: { notify: (...args) => notices.push(args) } };
  return { command, input, ctx, notices };
}

test("Pi selector and direct command use discovered names, keep images, and do not decode", async () => {
  const { command, input, ctx, notices } = harness();
  const images = [{ type: "image", data: "unchanged", mimeType: "image/png" }];
  assert.deepEqual(command.getArgumentCompletions("").map(item => item.value), [...ciphers.keys()]);
  assert.deepEqual(await input({ text: "Abc!", images }, ctx), { action: "transform", text: "Def!", images });
  await command.handler('affine [5,8]', ctx);
  assert.equal((await input({ text: "Abc!", images }, ctx)).text, "Ins!");
  await command.handler('atbash []', ctx);
  assert.equal((await input({ text: "Abc!", images }, ctx)).text, "Zyx!");
  ctx.hasUI = true;
  ctx.ui.select = async (_title, names) => { assert.deepEqual(names, [...ciphers.keys()]); return "vigenere"; };
  ctx.ui.input = async () => '["key"]';
  await command.handler("", ctx);
  assert.equal((await input({ text: "Abc!", images }, ctx)).text, "Kfa!");
  await command.handler('polybiusSquare {"args":[],"format":"compact"}', ctx);
  assert.equal((await input({ text: "Abc!", images }, ctx)).text, "111213");
  assert.equal(notices.at(-1)[0], "Cipher: polybiusSquare");
});

test("bad config/commands do not change selection; encryption errors stop outgoing input", async () => {
  for (const config of [{ cipher: "missing", args: [] }, { args: null }, { format: "bad" }, { shift: 0.5 }]) {
    assert.throws(() => readSettings(config, ciphers));
  }
  const { command, input, ctx, notices } = harness();
  await command.handler("", ctx);
  assert.ok(notices.at(-1)[0].includes([...ciphers.keys()].join(", ")));
  await command.handler('vigenere {"args":null}', ctx);
  assert.equal((await input({ text: "Abc!" }, ctx)).text, "Def!");
  await command.handler('railFence [1]', ctx);
  assert.deepEqual(await input({ text: "Never send this plaintext!" }, ctx), { action: "handled" });
  assert.ok(notices.at(-1)[0].includes("input was not sent"));
  await assert.rejects(encryptText("abc", settings("caesar", [-3]), ciphers));
  await assert.rejects(encryptText("abc", settings("autokey", ["key"]), ciphers));
  await assert.rejects(encryptText("abc", settings("vigenere", []), ciphers));
});
