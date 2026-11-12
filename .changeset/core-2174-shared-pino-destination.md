---
'@defra/cdp-auditing': minor
---

Export `destStdout` from `@defra/cdp-auditing` and wire the audit logger to use it, so services can share one
stdout destination across app, request and audit loggers and avoid interleaved JSON output under high load.
