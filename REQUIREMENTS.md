# Requirements and verification checklist

Source: all six pages of the Webtezza assessment PDF, read 2026-10-05. The PDF is the assessment specification; the pasted user request controls implementation and publishing authorization. Check boxes indicate verified completion, not merely code written.

| ID | Source | Requirement | Implementation / verification |
|---|---|---|---|
| R01 | PDF 1–2 | Only production batch verification and sewing gate; persistent full-stack app | [x] [UI](src/app/page.tsx), [API](src/app/api/%5B...path%5D/route.ts), [16 passing integration tests](tests/integration.test.ts); cloud delivery tracked separately |
| R02 | PDF 2,4 | Authenticated three roles, visible demo credentials, server separation of duties | [x] [Security](src/lib/security.ts), API role guards and login panel; HTTP role/forged-cookie tests pass; visual review pending |
| R03 | PDF 3 | Exact REC-BL01 and REC-CT02 recipes, categories, five components each, fabric and caps | [x] [Seed](prisma/seed.ts); exact recipe integration test passes |
| R04 | PDF 3 | Recipe, whole target quantity, roll ID, actual yards; immediate expected multipliers | [x] [OrderForm](src/app/page.tsx), [server createOrder](src/lib/workflow.ts); invalid-order and expected-count tests pass; browser interaction pending |
| R05 | PDF 2–3 | Cutting preparation, pending submission, verified approval, reasoned rejection and correction | [x] [actOnOrder](src/lib/workflow.ts); transition/correction/history tests pass |
| R06 | PDF 3–4 | Green match, yellow excess allowed, red shortage blocks UI and API (422) | [x] [Batch UI](src/app/page.tsx), [workflow](src/lib/workflow.ts); green/red/yellow HTTP tests pass; button behavior source-reviewed, not browser-verified |
| R07 | PDF 4 | Missing/uncounted blocks; non-verifier approval 403; server session identity/time | [x] [API](src/app/api/%5B...path%5D/route.ts) and workflow; missing, tampering and role tests pass |
| R08 | PDF 2,4 | Immutable persisted approval audit: verifier, timestamp, variances, wastage | [x] [Integrity migration](prisma/migrations/202610050002_integrity/migration.sql), transaction snapshot; HTTP plus direct database immutability tests pass |
| R09 | PDF 3–4 | Sewing database query WHERE status=VERIFIED; counts, attribution, assembly action | [x] [listOrders](src/lib/workflow.ts) and Batch UI; queue-param isolation, assembly and hidden-order regression tests pass |
| R10 | PDF 3 | Wastage=((actual−expected)/expected)*100; expected=quantity*standard yards | [x] [Decimal arithmetic](src/lib/workflow.ts); 94.5 / 90 yard case persists 5% in integration test |
| R11 | PDF 4 | Users, recipes, components (optional image), orders, verification items and logs, relational constraints | [x] [Schema](prisma/schema.prisma), two applied SQL migrations; relational persistence and immutable triggers exercised |
| R12 | PDF 4 | Five mandatory tests: green approval, red block, reason required, role 403, queue isolation | [x] [Tests](tests/integration.test.ts) cases 1–5 pass on production server |
| R13 | PDF 5–6 | High contrast inputs/dropdowns/focus, responsive UI, inline errors; persistence on reload | [ ] [Styles](src/app/globals.css) and UI implemented; seven [palette checks](scripts/contrast.mjs) and database persistence tests pass. Rendered contrast, responsive layout and browser reload walkthrough remain unverified |
| R14 | PDF 5 | Reject negative, fractional counts, nonnumeric and empty inputs | [x] [Strict schemas](src/lib/workflow.ts), inline messages; malformed/null/missing/input HTTP cases pass; decimal fabric exception documented |
| R15 | PDF 5 | AI report: tools/prompts, >=2 genuine flawed-code findings, refactoring attribution, architecture | [x] [AI report](AI_OPTIMIZATION_REPORT.md) records tools, four genuine findings, reviewed refactors, validation evidence, defensive architecture and candid AI attribution |
| R16 | PDF 5 | Four-day milestone plan (28–32 hours) | [x] [Implementation plan](IMPLEMENTATION_PLAN.md) records four practical work blocks totaling 30 focused hours without claiming fictitious elapsed days |
| R17 | PDF 6 | Public cloud URL, public GitHub, actual iterative commits | [x] Public [GitHub repository](https://github.com/kerthikan5/apparelflow-production-gate), live [Vercel deployment](https://apparelflow-production-gate.vercel.app), actual milestone history and successful GitHub Actions run verified |
| R18 | PDF 6 | README architecture/schema/demo credentials; passing executable tests | [x] [README](README.md), `npm test`; 16 production-server tests pass |
| R19 | User | Next.js/TypeScript/Tailwind/PostgreSQL/Prisma, secure password hashing, env example/no secrets | [x] [Dependencies](package.json), [security](src/lib/security.ts), [.env.example](.env.example), [.gitignore](.gitignore); build/typecheck/auth tests pass |
| R20 | User | Exact component set, reject duplicates/unknown/malformed values; ignore no client authority | [x] [Workflow](src/lib/workflow.ts); all adversarial payload cases pass |
| R21 | User | Atomic approval/audit, concurrent request protection, historical attempts | [x] Row locks/versioned transaction, unique approval and immutable history; concurrency, failed approval and correction tests pass |
| R22 | User | Extra integration tests; isolated test DB; typecheck/build/browser all roles | [ ] [Test runner](scripts/test.ts), [CI](.github/workflows/ci.yml), local `_test` PostgreSQL and deployed [remote smoke test](scripts/remote-smoke.mjs) pass. Browser UI review remains unavailable |
| R23 | User | Documentation/deployment preparation, explanation and final requirement report | [x] [README](README.md), this report, [verification record](VERIFICATION.md), AI report and real Git milestones; publishing handoff documented |

## Explicit seed specification

- Casual Blouse / REC-BL01 / Blouse: 1.8 yards, 5% cap. Front Body Panel 1; Back Body Panel 1; Sleeves (Left & Right) 2; Collar & Stand 1; Sleeve Cuffs 2.
- Crop Top / REC-CT02 / Crop Top: 1.1 yards, 8% cap. Front Chest Panel 1; Back Support Panel 1; Neck Binding Strip 1; Hem Elastic Casing 1; Side Strap Accents 2.

## Assumptions and decisions

- Positive decimal fabric yards are allowed because the supplied recipes use fractional yards. Garment/component counts must be whole integers. Actual components may be zero (a shortage).
- Wastage above the recipe cap is a warning, not a separate approval block. Negative calculated wastage is retained by the specified formula.
- Assembly uses a separate server timestamp while status remains VERIFIED, preserving the literal queue database filter and immutable QC decision.
- Recipes are seeded and read-only in this module; no recipe editing endpoint is necessary.
- Rejected orders may be corrected and resubmitted; historical decision snapshots remain immutable.
- Cloud deployment was completed after local preparation, as requested by the user.

## Task checklist

- [x] Read complete specification and inspect empty workspace.
- [x] Record requirements and practical four-day plan.
- [x] Implement schema, authentication, seeds and migrations; verify with PostgreSQL.
- [x] Implement protected workflow and role workspaces; build and typecheck pass.
- [x] Run 16 production-server integration tests, typecheck, build and palette contrast checks.
- [ ] Complete browser walkthrough and responsive visual review (no connected browser).
- [x] Complete README, AI findings, local milestones and completion report.
- [x] Publish the public repository, pass GitHub Actions and deploy to Vercel with managed PostgreSQL.
