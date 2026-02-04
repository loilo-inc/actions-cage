export function parseStringToArgs(rawArgs: string): string[] {
  // parse string like '--canaryTaskIdleDuration "value of any" --updateService'
  // into ['--canaryTaskIdleDuration', 'value of any', '--updateService']
  let idx = 0;
  let args: string[] = [];
  function skipWs(): void {
    while (idx < rawArgs.length && rawArgs[idx] === " ") {
      idx += 1;
    }
  }
  function readValue(): string {
    skipWs();
    let value = "";
    let quoteType: string | null = null;
    if (rawArgs[idx] === '"' || rawArgs[idx] === "'") {
      quoteType = rawArgs[idx];
      idx += 1;
    }
    while (idx < rawArgs.length) {
      if (quoteType && rawArgs[idx] === quoteType) {
        idx += 1;
        break;
      }
      if (!quoteType && rawArgs[idx] === " ") {
        break;
      }
      value += rawArgs[idx];
      idx += 1;
    }
    return value;
  }
  while (idx < rawArgs.length) {
    args.push(readValue());
  }
  return args;
}
