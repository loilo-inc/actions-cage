export type AuditSummary = {
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  info_count: number;
  total_count: number;
  highest_severity: Severity;
};

const sevOrder = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "INFORMATIONAL",
  "UNDEFINED",
] as const;
export type Severity = (typeof sevOrder)[number];

export type AuditVuln = {
  cve: {
    name: string;
    description: string;
    package_name: string;
    package_version: string;
    uri: string;
    severity: Severity;
  };
  containers: string[];
};

export type AuditResult = {
  region: string;
  cluster: string;
  service: string;
  summary: AuditSummary;
  vulns: AuditVuln[];
  scanned_at: string;
};

export type AuditIssueParams = {
  owner: string;
  repo: string;
  token: string;
  title: string;
};

export function sortVulnsBySeverity(a: AuditVuln, b: AuditVuln): number {
  const sevA = sevOrder.indexOf(a.cve.severity);
  const sevB = sevOrder.indexOf(b.cve.severity);
  if (sevA !== sevB) {
    return sevA - sevB;
  }
  return a.cve.name.localeCompare(b.cve.name);
}
