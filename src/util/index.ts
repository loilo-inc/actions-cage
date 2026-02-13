import * as core from "@actions/core";

export function assertInput(name: string): string {
  const v = core.getInput(name);
  if (!v) {
    throw new Error(`${name} is required`);
  }
  return v;
}

export function boolify(s: string): boolean {
  return s !== "" && !s.match(/^(false|0|undefined|null)$/i);
}

export function parseListInput(input: string): string[] {
  return input
    .replace(/\r\n/g, "\n")
    .split(/\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
