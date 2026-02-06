export type AuditSummary = {
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  info_count: number;
  total_count: number;
  highest_severity: string;
};

export type AuditVuln = {
  cve: {
    name: string;
    description: string;
    package_name: string;
    package_version: string;
    uri: string;
    severity: string;
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
