# Pi Caesar

A Pi extension that Caesar-shifts letters in outgoing prompts. Preserves case and passes images through.

```sh
git clone https://github.com/D3MZ/pi-caesar.git
pi -e ./pi-caesar
```

To install for a project, run `pi install -l /path/to/pi-caesar` from that project.

Edit `config.json` in `pi-caesar` and restart Pi:

```json
{ "shift": 3 }
```

The default shift is 3. Use an integer; negative values shift backwards, and shifts wrap modulo 26.
