## Scan Summary
- Region: `us-west-2`
- Cluster: `example-cluster`
- Service: `example-service`
- Scanned At: `2026-02-05T12:00:00Z`
- Highest Severity: `CRITICAL`

| Critical | High | Medium | Low | Info | Total |
| --- | --- | --- | --- | --- | --- |
| 1 | 1 | 0 | 0 | 0 | 2 |

## Vulnerabilities (2)
| Severity | CVE | Package | Version | Containers |
| --- | --- | --- | --- | --- |
| CRITICAL | [CVE-2026-0001](https://nvd.nist.gov/vuln/detail/CVE-2026-0001) | openssl | 3.0.0 | app |
| HIGH | [CVE-2026-0002](https://nvd.nist.gov/vuln/detail/CVE-2026-0002) | libexpat | 2.7.1 | app, worker |