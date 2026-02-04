import * as core from "@actions/core";
import * as io from "@actions/io";
import { run } from "./runner";

export async function setup() {
  run({ core, io }).catch((error) => {
    core.setFailed(error instanceof Error ? error.message : String(error));
  });
}
