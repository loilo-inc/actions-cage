import { AuditResult, AuditVuln, Severity, sortVulnsBySeverity } from "./types";

export function esc(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").replace(/`/g, "\\`");
}

export function renderAuditSummary(results: AuditResult[]): string {
  if (results.length === 0) {
    return "## Scan Summary\n\nNo services were scanned.";
  }
  const lines = ["## Scan Summary"];
  const totalVulns = results.reduce(
    (acc, res) => acc + res.summary.total_count,
    0,
  );
  lines.push(
    `- Total **${totalVulns}** vulnerabilities found across **${results.length}** services.`,
  );
  lines.push(...results.map(renderAuditResult));
  return lines.join("\n");
}

export function renderAuditResult(result: AuditResult): string {
  const {
    region,
    cluster,
    service,
    scanned_at,
    summary: { highest_severity },
  } = result;
  const lines = [
    `## \`${esc(cluster)}\` / \`${esc(service)}\` (\`${esc(region)}\`)`,
    "| Region | Cluster | Service | Scanned At | Highest Severity |",
    "| --- | --- | --- | --- | --- |",
    `| \`${esc(region)}\` | \`${esc(cluster)}\` | \`${esc(service)}\` | \`${esc(scanned_at)}\` | \`${esc(highest_severity)}\` |`,
    renderAlert(highest_severity),
    "",
  ];
  if (result.vulns.length > 0) {
    const vulnsHeader = [
      "| Severity | CVE | Package | Version | Containers |",
      "| --- | --- | --- | --- | --- |",
    ];
    const vulnsRows = result.vulns.sort(sortVulnsBySeverity).map(renderRow);
    lines.push(
      `### Vulnerabilities (${result.summary.total_count})`,
      "<details>",
      "<summary>Click to expand vulnerability details</summary>",
      "",
      ...vulnsHeader,
      ...vulnsRows,
      "</details>",
      "",
    );
  }
  return lines.join("\n");
}

export function renderRow(v: AuditVuln): string {
  const sev = esc(v.cve.severity);
  const uri = v.cve.uri.replace(/\|/g, "%7C");
  const cve = `[${esc(v.cve.name)}](${uri})`;
  const pkg = esc(v.cve.package_name);
  const ver = esc(v.cve.package_version);
  const containers = esc(v.containers.join(", "));
  return `| ${sev} | ${cve} | ${pkg} | ${ver} | ${containers} |`;
}

export function renderAlert(highest: Severity): string {
  if (highest === "CRITICAL" || highest === "HIGH") {
    return [
      "> [!CAUTION]",
      "> **Security Alert:** Critical or High severity vulnerabilities detected! Immediate action required.",
    ].join("\n");
  } else if (highest === "MEDIUM") {
    return [
      "> [!WARNING]",
      "> **Security Notice:** Medium severity vulnerabilities detected. Please review and address them promptly.",
    ].join("\n");
  } else if (highest === "LOW" || highest === "INFORMATIONAL") {
    return [
      "> [!INFO]",
      "> **Security Info:** No Critical or High severity vulnerabilities detected.",
    ].join("\n");
  }
  return [
    "> [!TIP]",
    "> **Security Good News:** No vulnerabilities detected!",
  ].join("\n");
}
