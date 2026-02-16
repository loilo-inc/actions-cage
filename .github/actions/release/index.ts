import * as core from "@actions/core";
import { release } from "../../../tools/release.js";

try {
  await release();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  core.setFailed(message);
}
