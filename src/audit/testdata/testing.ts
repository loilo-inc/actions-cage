import { AuditResult } from "../types";

export function makeAuditResult(
  overrides: Partial<AuditResult> = {},
): AuditResult {
  return {
    region: "us-west-2",
    cluster: "my-cluster",
    service: "my-service",
    scanned_at: "2024-01-01T00:00:00Z",
    summary: {
      critical_count: 1,
      high_count: 2,
      medium_count: 3,
      low_count: 4,
      info_count: 5,
      total_count: 15,
      highest_severity: "CRITICAL",
    },
    vulns: [
      {
        cve: {
          name: "CVE-2024-0001",
          description: "Sample vulnerability description.",
          package_name: "sample-package",
          package_version: "1.0.0",
          uri: "http://example.com/cve/CVE-2024-0001",
          severity: "CRITICAL",
        },
        containers: ["container-1", "container-2"],
      },
    ],
    ...overrides,
  };
}
