<!-- cage-audit:region=us-west-2;cluster=example-cluster;service=example-service -->
## Scan Summary
| Region | Cluster | Service | Scanned At | Highest Severity |
| --- | --- | --- | --- | --- |
| `us-west-2` | `example-cluster` | `example-service` | `2026-02-05T12:00:00Z` | `CRITICAL` |
> [!CAUTION]
> **Security Alert:** Critical or High severity vulnerabilities detected! Immediate action required.

### Vulnerabilities (2)
<details>
<summary>Click to expand vulnerability details</summary>

| Severity | CVE | Package | Version | Containers |
| --- | --- | --- | --- | --- |
| CRITICAL | [CVE-2026-0001](https://nvd.nist.gov/vuln/detail/CVE-2026-0001) | openssl | 3.0.0 | app |
| HIGH | [CVE-2026-0002](https://nvd.nist.gov/vuln/detail/CVE-2026-0002) | libexpat | 2.7.1 | app, worker |
</details>