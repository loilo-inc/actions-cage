import { AuditResult, AuditVuln, Severity, sortVulnsBySeverity } from "./types";

export function esc(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").replace(/`/g, "\\`");
}

export function renderAuditSummaryMarkdown(result: AuditResult): string {
  const {
    region,
    cluster,
    service,
    scanned_at,
    summary: { highest_severity },
  } = result;
  const meta = [
    "| Region | Cluster | Service | Scanned At | Highest Severity |",
    "| --- | --- | --- | --- | --- |",
    `| \`${esc(region)}\` | \`${esc(cluster)}\` | \`${esc(service)}\` | \`${esc(scanned_at)}\` | \`${esc(highest_severity)}\` |`,
  ];
  const vulnsSection = [];
  if (result.vulns.length > 0) {
    const vulnsHeader = [
      "| Severity | CVE | Package | Version | Containers |",
      "| --- | --- | --- | --- | --- |",
    ];
    const vulnsRows = result.vulns.sort(sortVulnsBySeverity).map(renderRow);
    vulnsSection.push(
      `### Vulnerabilities (${result.summary.total_count})`,
      "<details>",
      "<summary>Click to expand vulnerability details</summary>",
      "",
      ...vulnsHeader,
      ...vulnsRows,
      "</details>",
    );
  }
  return [
    "## Scan Summary",
    ...meta,
    renderAlert(highest_severity),
    "",
    ...vulnsSection,
  ].join("\n");
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
  } else if (highest === "LOW" || highest === "INFO") {
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

export function renderIssueBody(): string {
  return [
    "Cage audit report.",
    "",
    "Results are posted as comments per service.",
  ].join("\n");
}

export function buildCommentMarker(
  result: Pick<AuditResult, "service" | "cluster" | "region">,
): string {
  const sanitize = (s: string) => s.replace(/-->/g, "").trim();
  const cluster = sanitize(result.cluster);
  const region = sanitize(result.region);
  const service = sanitize(result.service);
  const sanitized = `region=${region};cluster=${cluster};service=${service}`;
  return `<!-- cage-audit:${sanitized} -->`;
}

export function buildCommentBody(result: AuditResult): string {
  const marker = buildCommentMarker(result);
  return [marker, renderAuditSummaryMarkdown(result)].join("\n");
}
