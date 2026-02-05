import * as core from "@actions/core";
export function parseRef(ref: string): string {
  // refs/heads/master -> master
  // refs/tags/v0.1.0 -> v0.1.0
  const m = ref.match(/^refs\/.+?\/(.+?)$/);
  if (m) {
    return m[1];
  }
  return ref;
}

export function assertInput(name: string): string {
  const v = core.getInput(name);
  if (!v) {
    throw new Error(`${name} is required`);
  }
  return v;
}

export function boolify(s: string): boolean {
  return s !== "" && !s.match(/^(false|0|undefined|null)$/);
}
