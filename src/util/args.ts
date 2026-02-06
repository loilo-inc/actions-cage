export function parseStringToArgs(rawArgs: string): string[] {
  if (!rawArgs || typeof rawArgs !== "string") {
    return [];
  }

  const args: string[] = [];
  let idx = 0;

  const skipWs = (): void => {
    while (idx < rawArgs.length && rawArgs[idx] === " ") {
      idx += 1;
    }
  };

  const readValue = (): string | null => {
    skipWs();

    if (idx >= rawArgs.length) {
      return null;
    }

    let value = "";
    const quoteChar =
      rawArgs[idx] === '"' || rawArgs[idx] === "'" ? rawArgs[idx] : null;

    if (quoteChar) {
      idx += 1;
      while (idx < rawArgs.length && rawArgs[idx] !== quoteChar) {
        value += rawArgs[idx];
        idx += 1;
      }
      if (idx < rawArgs.length && rawArgs[idx] === quoteChar) {
        idx += 1;
      }
    } else {
      while (idx < rawArgs.length && rawArgs[idx] !== " ") {
        value += rawArgs[idx];
        idx += 1;
      }
    }

    return value ?? null;
  };

  while (idx < rawArgs.length) {
    const value = readValue();
    if (value != null) {
      args.push(value);
    }
  }

  return args;
}
