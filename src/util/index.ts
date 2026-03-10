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

// Simple sprintf implementation that only supports %s
export function sprintf(
  template: string,
  ...args: (number | string)[]
): string {
  let index = 0;
  return template.replace(/%s/g, () => {
    const value = args[index];
    index += 1;
    return String(value ?? "");
  });
}

export function pluralize(
  count: number,
  singular: string,
  plural = singular + "s",
): string {
  return `${count === 1 ? singular : plural}`;
}
