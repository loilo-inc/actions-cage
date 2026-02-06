import * as exec from "@actions/exec";
import { AuditResult } from "./types";

export async function executeAudit(args: string[]): Promise<AuditResult> {
  const { stdout: outText } = await exec.getExecOutput("cage", [
    "audit",
    ...args,
    "--json",
  ]);
  const parsed = JSON.parse(outText);
  return parsed as AuditResult;
}
