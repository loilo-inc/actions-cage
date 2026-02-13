import { describe, expect, it } from "vitest";
import { AuditVuln, Severity, sortVulnsBySeverity } from "./types";

describe("sortVulnsBySeverity", () => {
  const createVuln = (severity: Severity, name: string): AuditVuln => ({
    cve: {
      name,
      description: "test",
      package_name: "pkg",
      package_version: "1.0.0",
      uri: "http://test",
      severity,
    },
    containers: [],
  });

  it("should sort vulnerabilities by severity order", () => {
    const vulns = [
      createVuln("INFORMATIONAL", "vuln1"),
      createVuln("CRITICAL", "vuln2"),
      createVuln("MEDIUM", "vuln3"),
    ];

    vulns.sort(sortVulnsBySeverity);

    expect(vulns[0].cve.severity).toBe("CRITICAL");
    expect(vulns[1].cve.severity).toBe("MEDIUM");
    expect(vulns[2].cve.severity).toBe("INFORMATIONAL");
  });

  it("should sort by name when severities are equal", () => {
    const vulns = [
      createVuln("HIGH", "zebra"),
      createVuln("HIGH", "alpha"),
      createVuln("HIGH", "beta"),
    ];

    vulns.sort(sortVulnsBySeverity);

    expect(vulns[0].cve.name).toBe("alpha");
    expect(vulns[1].cve.name).toBe("beta");
    expect(vulns[2].cve.name).toBe("zebra");
  });

  it("should handle case-insensitive severity comparison", () => {
    const vulns = [
      createVuln("INFORMATIONAL", "vuln1"),
      createVuln("CRITICAL", "vuln2"),
      createVuln("MEDIUM", "vuln3"),
    ];

    vulns.sort(sortVulnsBySeverity);

    expect(vulns[0].cve.severity).toBe("CRITICAL");
    expect(vulns[1].cve.severity).toBe("MEDIUM");
    expect(vulns[2].cve.severity).toBe("INFORMATIONAL");
  });

  it("should maintain all severity levels in correct order", () => {
    const vulns = [
      createVuln("LOW", "vuln1"),
      createVuln("HIGH", "vuln2"),
      createVuln("INFORMATIONAL", "vuln3"),
      createVuln("CRITICAL", "vuln4"),
      createVuln("MEDIUM", "vuln5"),
    ];

    vulns.sort(sortVulnsBySeverity);
    expect(vulns.map((v) => v.cve.severity)).toEqual([
      "CRITICAL",
      "HIGH",
      "MEDIUM",
      "LOW",
      "INFORMATIONAL",
    ]);
  });
});
