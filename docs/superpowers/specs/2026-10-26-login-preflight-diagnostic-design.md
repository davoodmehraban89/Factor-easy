# Login preflight comparison

The affected PC reaches the keyless gateway directly but ordinary Auth and REST diagnostics time out in both normal and Incognito Chrome. The approximately matching server window contains OPTIONS200 without subsequent GETs. Cloud success does not reproduce that failure.

The owner's existing instruction is to investigate and complete the login repair autonomously. This diagnostic is a reversible evidence-collection step within that scope; it does not establish a connectivity repair or authorize production configuration changes.

## Approach

Implementation choice: extend the existing diagnostic action with one concurrent simple CORS GET to the same health endpoint. It reuses only the existing explicitly publishable key in the query, omits credentials and sends no custom headers. Ordinary Auth/REST probes and actual authentication remain unchanged. A bare401 would test only the gateway; the simple keyed request tests the same project endpoint. A new proxy/custom domain needs separate evidence and authorization.

- Only /^sb_publishable_[A-Za-z0-9_-]+$/ keys may enter the supplementary query. Other configured keys produce SIMPLE_SKIPPED; never place a secret/legacy JWT into this URL.
- All five probes use the same fresh finora_diag query identifier for bounded log correlation, separate12-second deadlines, and header-only results. Never read a response body or call an account/table endpoint.
- Preserve existing failure classification. SIMPLE_HTTP_200 cannot make failed ordinary Auth/REST healthy or establish login success.
- Publish window.FinoraLoginConnectivityReport with only id, version, checkedAt, origin, durationMs and probes. Each fixed probe has only code and durationMs. No identity, key, token, header, body, raw exception or full URL.
- Display UTC/id/per-probe durations in the existing output. Clear a previous report before a fresh/offline/failed check. Keep duplicate-click suppression.
- Cache version20261026-preflight-compare-v5 applies only to the diagnostic script and its self-probe. No Auth transport, accounting, storage, CSP/RLS, DNS or server changes.

Success here means an accurate privacy-safe comparison is deployed and usable. The affected-PC connection and actual login remain NOT VERIFIED until the owner-side result supports a repair and acceptance.
