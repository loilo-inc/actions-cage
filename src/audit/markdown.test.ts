import { readFile } from "fs/promises";
import path from "node:path";
import { fileURLToPath } from "url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildCommentBody,
  buildCommentMarker,
  esc,
  renderAlert,
  renderAuditSummaryMarkdown,
  renderIssueBody,
  renderRow,
} from "./markdown";
import type { AuditResult, AuditVuln } from "./types";

const resolve = (s: string) =>
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".", s);

async function readSample(p: string): Promise<AuditResult> {
  const data = await readFile(resolve(p), "utf-8");
  return JSON.parse(data) as AuditResult;
}

describe("renderAuditSummaryMarkdown", () => {
  it("should escape pipe characters in metadata", () => {
    const result: AuditResult = {
      region: "us|east",
      cluster: "prod|cluster",
      service: "api|service",
      scanned_at: "2024-01-01",
      summary: {
        highest_severity: "CRITICAL",
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        info_count: 0,
        total_count: 0,
      },
      vulns: [],
    };
    const md = renderAuditSummaryMarkdown(result);
    expect(md).toContain("| `us\\|east` |");
    expect(md).toContain("| `prod\\|cluster` |");
    expect(md).toContain("| `api\\|service` |");
  });

  it("should escape newlines in metadata", () => {
    const result: AuditResult = {
      region: "us-east\nmalicious",
      cluster: "prod",
      service: "api",
      scanned_at: "2024-01-01",
      summary: {
        highest_severity: "CRITICAL",
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        info_count: 0,
        total_count: 0,
      },
      vulns: [],
    };
    const md = renderAuditSummaryMarkdown(result);
    expect(md).toContain("| `us-east malicious` |");
  });

  it("should render expandable details for vulnerabilities", () => {
    const result: AuditResult = {
      region: "us-east",
      cluster: "prod",
      service: "api",
      scanned_at: "2024-01-01",
      summary: {
        highest_severity: "CRITICAL",
        critical_count: 1,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        info_count: 0,
        total_count: 1,
      },
      vulns: [
        {
          cve: {
            name: "CVE-2024-1234",
            uri: "https://example.com/cve",
            severity: "CRITICAL",
            description: "Example vulnerability",
            package_name: "openssl",
            package_version: "1.0.0",
          },
          containers: ["container-1", "container-2"],
        },
      ],
    };
    const md = renderAuditSummaryMarkdown(result);
    expect(md).toContain("<details>");
    expect(md).toContain(
      "<summary>Click to expand vulnerability details</summary>",
    );
    expect(md).toContain("[CVE-2024-1234](https://example.com/cve)");
    expect(md).toContain("container-1, container-2");
  });

  it("should sort vulnerabilities by severity", () => {
    const result: AuditResult = {
      region: "us-east",
      cluster: "prod",
      service: "api",
      scanned_at: "2024-01-01",
      summary: {
        highest_severity: "CRITICAL",
        critical_count: 1,
        high_count: 2,
        medium_count: 0,
        low_count: 0,
        info_count: 0,
        total_count: 3,
      },
      vulns: [
        {
          cve: {
            name: "CVE-LOW",
            uri: "https://example.com/low",
            severity: "LOW",
            description: "Low",
            package_name: "pkg1",
            package_version: "1.0.0",
          },
          containers: ["c1"],
        },
        {
          cve: {
            name: "CVE-CRITICAL",
            uri: "https://example.com/critical",
            severity: "CRITICAL",
            description: "Critical",
            package_name: "pkg2",
            package_version: "1.0.0",
          },
          containers: ["c2"],
        },
        {
          cve: {
            name: "CVE-HIGH",
            uri: "https://example.com/high",
            severity: "HIGH",
            description: "High",
            package_name: "pkg3",
            package_version: "1.0.0",
          },
          containers: ["c3"],
        },
      ],
    };
    const md = renderAuditSummaryMarkdown(result);
    const criticalIndex = md.indexOf("CVE-CRITICAL");
    const highIndex = md.indexOf("CVE-HIGH");
    const lowIndex = md.indexOf("CVE-LOW");
    expect(criticalIndex).toBeLessThan(highIndex);
    expect(highIndex).toBeLessThan(lowIndex);
  });
});

describe("renderIssueBody", () => {
  it("should render issue body", () => {
    const body = renderIssueBody();
    expect(body).toContain("Cage audit report.");
    expect(body).toContain("Results are posted as comments per service.");
  });
});

describe("buildCommentBody", () => {
  let okResult: AuditResult;
  let withVulnResult: AuditResult;
  beforeAll(async () => {
    [withVulnResult, okResult] = await Promise.all([
      readSample("testdata/audit-with-vulns.json"),
      readSample("testdata/audit-ok.json"),
    ]);
  });
  it("renders markdown summary", async () => {
    const md = buildCommentBody(okResult);
    expect(md).toMatchFileSnapshot(resolve("testdata/markdown-ok-snapshot.md"));
  });
  it("renders markdown with vulnerabilities", async () => {
    const md = buildCommentBody(withVulnResult);
    expect(md).toMatchFileSnapshot(
      resolve("testdata/markdown-with-vulns-snapshot.md"),
    );
  });
  it("should include marker and rendered markdown", () => {
    const result: AuditResult = {
      region: "us-east",
      cluster: "prod",
      service: "api",
      scanned_at: "2024-01-01",
      summary: {
        highest_severity: "LOW",
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        info_count: 0,
        total_count: 0,
      },
      vulns: [],
    };
    const body = buildCommentBody(result);
    expect(body).toContain(
      `<!-- cage-audit:region=us-east;cluster=prod;service=api -->`,
    );
    expect(body).toContain("## Scan Summary");
  });
});

describe("buildCommentMarker", () => {
  it("should build a comment marker with region, cluster, and service", () => {
    const result = {
      region: "us-east",
      cluster: "prod",
      service: "api",
    };
    const marker = buildCommentMarker(result);
    expect(marker).toBe(
      "<!-- cage-audit:region=us-east;cluster=prod;service=api -->",
    );
  });

  it("should escape HTML comment closing tags", () => {
    const result = {
      region: "us-->east",
      cluster: "prod-->cluster",
      service: "api-->service",
    };
    const marker = buildCommentMarker(result);
    expect(marker).toBe(
      "<!-- cage-audit:region=useast;cluster=prodcluster;service=apiservice -->",
    );
  });

  it("should trim whitespace from values", () => {
    const result = {
      region: "  us-east  ",
      cluster: " prod ",
      service: "\tapi\n",
    };
    const marker = buildCommentMarker(result);
    expect(marker).toBe(
      "<!-- cage-audit:region=us-east;cluster=prod;service=api -->",
    );
  });

  it("should handle empty strings", () => {
    const result = {
      region: "",
      cluster: "",
      service: "",
    };
    const marker = buildCommentMarker(result);
    expect(marker).toBe("<!-- cage-audit:region=;cluster=;service= -->");
  });

  it("should handle multiple comment closing tags", () => {
    const result = {
      region: "us-->east-->region",
      cluster: "prod",
      service: "api",
    };
    const marker = buildCommentMarker(result);
    expect(marker).toBe(
      "<!-- cage-audit:region=useastregion;cluster=prod;service=api -->",
    );
  });
});

describe("renderRow", () => {
  it("should render a vulnerability row with all fields", () => {
    const vuln: AuditVuln = {
      cve: {
        name: "CVE-2024-1234",
        uri: "https://example.com/cve/2024-1234",
        severity: "CRITICAL",
        description: "Test vulnerability",
        package_name: "openssl",
        package_version: "1.0.0",
      },
      containers: ["container-1", "container-2"],
    };
    const row = renderRow(vuln);
    expect(row).toBe(
      "| CRITICAL | [CVE-2024-1234](https://example.com/cve/2024-1234) | openssl | 1.0.0 | container-1, container-2 |",
    );
  });

  it("should escape pipe characters in uri", () => {
    const vuln: AuditVuln = {
      cve: {
        name: "CVE-2024-1234",
        uri: "https://example.com/cve|2024|1234",
        severity: "HIGH",
        description: "Test",
        package_name: "pkg",
        package_version: "1.0.0",
      },
      containers: ["container"],
    };
    const row = renderRow(vuln);
    expect(row).toContain(
      "[CVE-2024-1234](https://example.com/cve%7C2024%7C1234)",
    );
  });

  it("should escape pipe characters in CVE name", () => {
    const vuln: AuditVuln = {
      cve: {
        name: "CVE|2024|1234",
        uri: "https://example.com/cve",
        severity: "HIGH",
        description: "Test",
        package_name: "pkg",
        package_version: "1.0.0",
      },
      containers: ["container"],
    };
    const row = renderRow(vuln);
    expect(row).toContain("[CVE\\|2024\\|1234]");
  });

  it("should escape newlines in package name", () => {
    const vuln: AuditVuln = {
      cve: {
        name: "CVE-2024-1234",
        uri: "https://example.com/cve",
        severity: "MEDIUM",
        description: "Test",
        package_name: "open\nssl",
        package_version: "1.0.0",
      },
      containers: ["container"],
    };
    const row = renderRow(vuln);
    expect(row).toContain("open ssl");
  });

  it("should handle single container", () => {
    const vuln: AuditVuln = {
      cve: {
        name: "CVE-2024-1234",
        uri: "https://example.com/cve",
        severity: "LOW",
        description: "Test",
        package_name: "pkg",
        package_version: "1.0.0",
      },
      containers: ["single-container"],
    };
    const row = renderRow(vuln);
    expect(row).toContain("single-container |");
  });

  it("should handle multiple containers", () => {
    const vuln: AuditVuln = {
      cve: {
        name: "CVE-2024-1234",
        uri: "https://example.com/cve",
        severity: "INFO",
        description: "Test",
        package_name: "pkg",
        package_version: "1.0.0",
      },
      containers: ["app", "worker", "web"],
    };
    const row = renderRow(vuln);
    expect(row).toContain("app, worker, web");
  });
});

describe("esc", () => {
  it("should escape pipe characters", () => {
    expect(esc("foo|bar")).toBe("foo\\|bar");
    expect(esc("a|b|c")).toBe("a\\|b\\|c");
  });

  it("should escape backticks", () => {
    expect(esc("foo`bar")).toBe("foo\\`bar");
    expect(esc("`code`")).toBe("\\`code\\`");
  });

  it("should convert newlines to spaces", () => {
    expect(esc("foo\nbar")).toBe("foo bar");
    expect(esc("foo\r\nbar")).toBe("foo bar");
  });

  it("should handle multiple escape types", () => {
    expect(esc("foo|bar`baz\nqux")).toBe("foo\\|bar\\`baz qux");
    expect(esc("`code|with\nnewline`")).toBe("\\`code\\|with newline\\`");
  });

  it("should handle empty string", () => {
    expect(esc("")).toBe("");
  });

  it("should not modify text without special characters", () => {
    expect(esc("normal text")).toBe("normal text");
  });
});

describe("renderAlert", () => {
  it("should render caution alert for CRITICAL severity", () => {
    const alert = renderAlert("CRITICAL");
    expect(alert).toContain("> [!CAUTION]");
    expect(alert).toContain(
      "> **Security Alert:** Critical or High severity vulnerabilities detected! Immediate action required.",
    );
  });

  it("should render caution alert for HIGH severity", () => {
    const alert = renderAlert("HIGH");
    expect(alert).toContain("> [!CAUTION]");
    expect(alert).toContain(
      "> **Security Alert:** Critical or High severity vulnerabilities detected! Immediate action required.",
    );
  });

  it("should render warning alert for MEDIUM severity", () => {
    const alert = renderAlert("MEDIUM");
    expect(alert).toContain("> [!WARNING]");
    expect(alert).toContain(
      "> **Security Notice:** Medium severity vulnerabilities detected. Please review and address them promptly.",
    );
  });

  it("should render info alert for LOW severity", () => {
    const alert = renderAlert("LOW");
    expect(alert).toContain("> [!INFO]");
    expect(alert).toContain(
      "> **Security Info:** No Critical or High severity vulnerabilities detected.",
    );
  });

  it("should render info alert for INFO severity", () => {
    const alert = renderAlert("INFO");
    expect(alert).toContain("> [!INFO]");
    expect(alert).toContain(
      "> **Security Info:** No Critical or High severity vulnerabilities detected.",
    );
  });

  it("should render tip alert for UNDEFINED severity", () => {
    const alert = renderAlert("UNDEFINED");
    expect(alert).toContain("> [!TIP]");
    expect(alert).toContain(
      "> **Security Good News:** No vulnerabilities detected!",
    );
  });

  it("should format alert with newlines", () => {
    const alert = renderAlert("CRITICAL");
    const lines = alert.split("\n");
    expect(lines).toHaveLength(2);
  });
});
