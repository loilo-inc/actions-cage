import { describe, expect, it } from "vitest";
import { AuditVuln, sortVulnsBySeverity } from "./types";

describe("sortVulnsBySeverity", () => {
  const createVuln = (severity: string, name: string): AuditVuln => ({
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
      createVuln("info", "vuln1"),
      createVuln("critical", "vuln2"),
      createVuln("medium", "vuln3"),
    ];

    vulns.sort(sortVulnsBySeverity);

    expect(vulns[0].cve.severity).toBe("critical");
    expect(vulns[1].cve.severity).toBe("medium");
    expect(vulns[2].cve.severity).toBe("info");
  });

  it("should sort by name when severities are equal", () => {
    const vulns = [
      createVuln("high", "zebra"),
      createVuln("high", "alpha"),
      createVuln("high", "beta"),
    ];

    vulns.sort(sortVulnsBySeverity);

    expect(vulns[0].cve.name).toBe("alpha");
    expect(vulns[1].cve.name).toBe("beta");
    expect(vulns[2].cve.name).toBe("zebra");
  });

  it("should handle case-insensitive severity comparison", () => {
    const vulns = [
      createVuln("INFO", "vuln1"),
      createVuln("CRITICAL", "vuln2"),
      createVuln("Medium", "vuln3"),
    ];

    vulns.sort(sortVulnsBySeverity);

    expect(vulns[0].cve.severity).toBe("CRITICAL");
    expect(vulns[1].cve.severity).toBe("Medium");
    expect(vulns[2].cve.severity).toBe("INFO");
  });

  it("should maintain all severity levels in correct order", () => {
    const vulns = [
      createVuln("low", "vuln1"),
      createVuln("high", "vuln2"),
      createVuln("info", "vuln3"),
      createVuln("critical", "vuln4"),
      createVuln("medium", "vuln5"),
    ];

    vulns.sort(sortVulnsBySeverity);

    const severities = vulns.map((v) => v.cve.severity.toLowerCase());
    expect(severities).toEqual(["critical", "high", "medium", "low", "info"]);
  });
});
