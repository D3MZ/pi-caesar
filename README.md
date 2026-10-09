# Pi Caesar

A Pi extension that encrypts outgoing prompt letters with [cipherTS](https://github.com/ruairidhflint/cipherTS). Images pass through; replies stay as received.

```sh
git clone https://github.com/D3MZ/pi-caesar.git
cd pi-caesar
npm ci
pi -e ./pi-caesar.ts
```

To install for a project, run `pi install -l /path/to/pi-caesar` from that project.

Use `/cipher` to pick any discovered export with an `encrypt` method and enter its JSON arguments. Or select directly: `/cipher vigenere ["key"]`, `/cipher affine [5,8]`, `/cipher atbash []`.

For a persistent default, edit `config.json`, then `/reload` or restart Pi:

```json
{ "cipher": "caesar", "args": [3], "format": "preserve" }
```

`args` are forwarded after plaintext, including object options. Use the package's [types](https://unpkg.com/cipherts@0.1.3/dist/index.d.ts) for their order; it has no runtime argument schemas. The old `{ "shift": -3 }` config still wraps modulo 26; new arguments follow package rules.

`preserve` keeps case and nonletters when output is one letter per input letter. Other outputs (such as Polybius digits) contain only encrypted letters. `compact` always returns package output: `/cipher polybiusSquare {"args":[],"format":"compact"}`. Cipher/key errors stop input from being sent. Selections last until reload; updated compatible exports appear on reload after you update the dependency.
