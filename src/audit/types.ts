export type AuditSummary = {
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  info_count: number;
  total_count: number;
  highest_severity: Severity;
};

export type Severity =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "INFO"
  | "UNDEFINED";

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

const sevOrder = ["critical", "high", "medium", "low", "info"];
export function sortVulnsBySeverity(a: AuditVuln, b: AuditVuln): number {
  const sevA = sevOrder.indexOf(a.cve.severity.toLowerCase());
  const sevB = sevOrder.indexOf(b.cve.severity.toLowerCase());
  if (sevA !== sevB) {
    return sevA - sevB;
  }
  return a.cve.name.localeCompare(b.cve.name);
}
