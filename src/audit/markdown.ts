import { AuditResult } from "./types";

function markdownEscape(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function renderAuditSummaryMarkdown(result: AuditResult): string {
  const meta = [
    `- Region: \`${result.region}\``,
    `- Cluster: \`${result.cluster}\``,
    `- Service: \`${result.service}\``,
    `- Scanned At: \`${result.scanned_at}\``,
    `- Highest Severity: \`${result.summary.highest_severity}\``,
  ];

  const summaryTable = [
    "| Critical | High | Medium | Low | Info | Total |",
    "| --- | --- | --- | --- | --- | --- |",
    `| ${result.summary.critical_count} | ${result.summary.high_count} | ${result.summary.medium_count} | ${result.summary.low_count} | ${result.summary.info_count} | ${result.summary.total_count} |`,
  ];

  const vulnsHeader = [
    "| Severity | CVE | Package | Version | Containers |",
    "| --- | --- | --- | --- | --- |",
  ];

  const vulnsRows = result.vulns.map((v) => {
    const sev = v.cve.severity;
    const cve = `[${markdownEscape(v.cve.name)}](${v.cve.uri})`;
    const pkg = markdownEscape(v.cve.package_name);
    const ver = markdownEscape(v.cve.package_version);
    const containers = markdownEscape(v.containers.join(", "));
    return `| ${sev} | ${cve} | ${pkg} | ${ver} | ${containers} |`;
  });

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

export function renderIssueBody(): string {
  return [
    "Cage audit report.",
    "",
    "Results are posted as comments per service.",
  ].join("\n");
}
