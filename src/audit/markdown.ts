import { AuditResult, AuditVuln } from "./types";

function esc(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function renderAuditSummaryMarkdown(result: AuditResult): string {
  const {
    region,
    cluster,
    service,
    scanned_at,
    summary: {
      highest_severity,
      critical_count,
      high_count,
      medium_count,
      low_count,
      info_count,
      total_count,
    },
  } = result;
  const meta = [
    `- Region: \`${esc(region)}\``,
    `- Cluster: \`${esc(cluster)}\``,
    `- Service: \`${esc(service)}\``,
    `- Scanned At: \`${esc(scanned_at)}\``,
    `- Highest Severity: \`${esc(highest_severity)}\``,
  ];

  const summaryTable = [
    "| Critical | High | Medium | Low | Info | Total |",
    "| --- | --- | --- | --- | --- | --- |",
    `| ${critical_count} | ${high_count} | ${medium_count} | ${low_count} | ${info_count} | ${total_count} |`,
  ];

  const vulnsHeader = [
    "| Severity | CVE | Package | Version | Containers |",
    "| --- | --- | --- | --- | --- |",
  ];

  const vulnsRows = result.vulns.map(renderRow);

  const vulnsSection =
    result.vulns.length === 0
      ? ["🐣 No vulnerabilities found! "]
      : [
          "<details>",
          "<summary>Click to expand vulnerability details</summary>",
          "",
          ...vulnsHeader,
          ...vulnsRows,
          "</details>",
        ];
  return [
    "## Scan Summary",
    ...meta,
    "",
    ...summaryTable,
    "",
    `## Vulnerabilities (${result.summary.total_count})`,
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
