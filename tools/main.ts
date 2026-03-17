import { parseArgs } from "node:util";
import { build } from "./build";

export async function main(args: string[]) {
  const {
    values: { version },
    positionals: [command],
  } = parseArgs({
    args,
    allowPositionals: true,
    options: { version: { type: "string", default: "0.0.0" } },
  });
  if (command === "build") {
    await build({ version });
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
}

if (import.meta.main) {
  await main(process.argv.slice(2)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
