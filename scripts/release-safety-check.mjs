import fs from 'node:fs';
import './public-qa-regression-check.mjs';

const qa = fs.readFileSync('.github/workflows/qa.yml', 'utf8');
const security = fs.readFileSync('.github/workflows/security.yml', 'utf8');
const gate = fs.existsSync('.github/workflows/release-gate.yml')
  ? fs.readFileSync('.github/workflows/release-gate.yml', 'utf8')
  : '';
const pages = fs.existsSync('.github/workflows/pages.yml')
  ? fs.readFileSync('.github/workflows/pages.yml', 'utf8')
  : '';

function must(condition, message) {
  if (!condition) throw new Error(`Release safety invariant failed: ${message}`);
}

must(!/continue-on-error\s*:\s*true/i.test(qa), 'manual QA must never continue after Playwright failure');
must(/Require live QA credentials/.test(qa), 'live/all suites must hard-fail when credentials are absent');
must(/inputs\.suite == 'live' \|\| inputs\.suite == 'all'/.test(qa), 'credential gate must cover both live and all suites');
must(/Validate requested QA target before credentials/.test(qa), 'BASE_URL must be validated before credential-bearing steps');
must(/allowedLiveOrigins/.test(qa) && /Refusing to expose live-test credentials/.test(qa), 'live credential origins must be explicitly allowlisted');
must(/assertAllowedOrigin\(page\.url\(\)\)/.test(qa), 'browser origin must be re-asserted before/after authenticated navigation');
must(!/\.click\([^\n]*\)\.catch\(\(\)\s*=>\s*\{\}\)/.test(qa), 'menu click failures must not be swallowed');
must(/menu item did not change navigation\/view state/.test(qa), 'menu crawl must assert a real navigation/view-state change');
must(/retention-days:\s*3/.test(qa), 'QA evidence retention must remain minimal');

must(!/continue-on-error\s*:\s*true/i.test(security), 'security workflow must not fail open');
must(/Dependency review \\(fail closed when Dependency Graph is enabled\\)/.test(security), 'dependency review must remain fail closed when enabled');
must(/vars\\.DEPENDENCY_GRAPH_ENABLED == 'true'/.test(security), 'dependency review must be gated on explicit Dependency Graph availability');

must(gate.length > 0, 'exact-SHA promotion gate workflow must exist');
must(/workflow_run/.test(gate), 'promotion gate must be driven by completed required workflows');
must(/head_sha/.test(gate), 'promotion gate must bind evidence to the exact tested SHA');
must(/d1-request-database/.test(gate) && /c8-policy-database/.test(gate), 'promotion gate must verify database jobs, not only top-level workflow conclusion');
must(/Security checks/.test(gate) && /Quality checks/.test(gate), 'promotion gate must require both Quality and Security');

must(pages.length > 0, 'gated Pages deployment workflow must exist');
must(/workflows:\s*\["Release gate"\]/.test(pages), 'Pages deployment must be downstream of Release gate');
must(/github\.event\.workflow_run\.conclusion == 'success'/.test(pages), 'Pages deployment must reject failed release gates');
must(/github\.event\.workflow_run\.head_sha/.test(pages), 'Pages deployment must checkout the exact gated SHA');
must(/scripts\/build-pages\.mjs/.test(pages), 'Pages deployment must use the hardened bounded artifact builder');

console.log('Release/QA safety invariants: PASS');
