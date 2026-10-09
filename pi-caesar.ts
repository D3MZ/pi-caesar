import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { shift } from "./config.json";
if (!Number.isInteger(shift)) throw new Error("Pi Caesar: config.json shift must be an integer");
const offset = ((shift % 26) + 26) % 26;
const lower = "abcdefghijklmnopqrstuvwxyz";
const rotated = lower.slice(offset) + lower.slice(0, offset);
const alphabet = lower.toUpperCase() + lower;
const shifted = rotated.toUpperCase() + rotated;
export default (pi: ExtensionAPI) => {
  pi.on("input", ({ text, images }) => ({ action: "transform", text: text.replace(/[A-Za-z]/g, c => shifted.charAt(alphabet.indexOf(c))), images }));
};
