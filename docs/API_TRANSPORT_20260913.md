# API destination boundary — 13 September 2026

This is preparatory integration security, not a new provider activation.
Kasa remains a synthetic, read-only pilot; production authentication, persistence
and private provider adapters are not completed by this change.

## Change

- Resolve every client path against the explicitly configured API directory.
- Reject absolute/cross-origin paths, traversal, backslashes, control characters,
  embedded URL credentials, base queries/fragments and encoded path segments.
- Require HTTPS remotely; preserve same-origin loopback HTTP testing and
  explicitly development-only loopback requests across local ports.
- Enforce `redirect: error` after caller options. A redirect or network failure
  is not retried. Preserve request body, headers and the existing timeout signal.
- Keep raw public API configuration until validation, rather than normalizing
  away invalid characters first. No secret configuration was read or added.
- Include the pure module and its offline test in the source-only Docker
  allowlist; update the independent Docker-context inventory as well.

## Verification

The isolated transport test uses an injected fetch function and no environment
loader: **46 checks passed without network requests**. TypeScript validation and
format checks passed. The Docker-context test passed with 16 reviewed source
files included and 31 invented private/nested files excluded. A second independent
review found no remaining origin/prefix/redirect bypass in this bounded change.

The native targeted lint passed. The complete source-only Linux Docker
`verification` target also passed formatting, lint, type checks, frontend/backend
builds, 9 API checks, the 46 destination checks and 8 deployment checks. Its local
image is `kasa:api-transport-check-20260913`; it was not pushed or deployed.

A separate production-dependency audit reported an existing moderate `qs@6.15.3`
finding. The maintainer identifies 6.16.0 as patched in
[GHSA-4mjr-xmp4-gh2g](https://github.com/ljharb/qs/security/advisories/GHSA-4mjr-xmp4-gh2g).
The audit also reports GHSA-x5fp-wj9c-mxmx. Dependencies were not changed in this
transport phase; a reviewed lockfile update/retest remains before production.
The server currently selects the simple query parser and JSON bodies, but this
observation is not a claim that every vulnerable dependency path is unreachable.

No cloud resource, provider account, subscription, payment, customer record or
runtime credential was changed.
