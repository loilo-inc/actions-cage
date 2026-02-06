import { readFile } from "fs/promises";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildCommentBody,
  buildCommentMarker,
  renderAuditSummaryMarkdown,
  renderIssueBody,
} from "./markdown";
import type { AuditResult } from "./types";

async function readSample(path: string): Promise<AuditResult> {
  const data = await readFile(
    resolve(fileURLToPath(import.meta.url), "..", path),
    "utf-8",
  );
  return JSON.parse(data) as AuditResult;
}

describe("renderAuditSummaryMarkdown", () => {
  let okResult: AuditResult;
  let withVulnResult: AuditResult;
  beforeAll(async () => {
    [withVulnResult, okResult] = await Promise.all([
      readSample("testdata/audit-with-vulns.json"),
      readSample("testdata/audit-ok.json"),
    ]);
  });
  it("renders markdown summary", async () => {
    const md = renderAuditSummaryMarkdown(okResult);
    await expect(md).toMatchFileSnapshot(resolve("testdata/audit-ok.md"));
  });
  it("renders markdown with vulnerabilities", async () => {
    const md = renderAuditSummaryMarkdown(withVulnResult);
    await expect(md).toMatchFileSnapshot(
      resolve("testdata/audit-with-vulns.md"),
    );
  });

  it("should escape pipe characters in metadata", () => {
    const result: AuditResult = {
      region: "us|east",
      cluster: "prod|cluster",
      service: "api|service",
      scanned_at: "2024-01-01",
      summary: {
        highest_severity: "critical",
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
    expect(md).toContain("Region: `us\\|east`");
    expect(md).toContain("Cluster: `prod\\|cluster`");
    expect(md).toContain("Service: `api\\|service`");
  });

  it("should escape newlines in metadata", () => {
    const result: AuditResult = {
      region: "us-east\nmalicious",
      cluster: "prod",
      service: "api",
      scanned_at: "2024-01-01",
      summary: {
        highest_severity: "critical",
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
    expect(md).toContain("Region: `us-east malicious`");
  });

  it("should display summary table with counts", () => {
    const result: AuditResult = {
      region: "us-east",
      cluster: "prod",
      service: "api",
      scanned_at: "2024-01-01",
      summary: {
        highest_severity: "high",
        critical_count: 5,
        high_count: 10,
        medium_count: 3,
        low_count: 2,
        info_count: 1,
        total_count: 21,
      },
      vulns: [],
    };
    const md = renderAuditSummaryMarkdown(result);
    expect(md).toContain("| 5 | 10 | 3 | 2 | 1 | 21 |");
  });

  it("should render expandable details for vulnerabilities", () => {
    const result: AuditResult = {
      region: "us-east",
      cluster: "prod",
      service: "api",
      scanned_at: "2024-01-01",
      summary: {
        highest_severity: "critical",
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
            severity: "critical",
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
});

describe("renderIssueBody", () => {
  it("should render issue body", () => {
    const body = renderIssueBody();
    expect(body).toContain("Cage audit report.");
    expect(body).toContain("Results are posted as comments per service.");
  });
});

describe("buildCommentBody", () => {
  it("should include marker and rendered markdown", () => {
    const result: AuditResult = {
      region: "us-east",
      cluster: "prod",
      service: "api",
      scanned_at: "2024-01-01",
      summary: {
        highest_severity: "low",
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
