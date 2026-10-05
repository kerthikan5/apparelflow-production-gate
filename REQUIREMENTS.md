# Requirements and verification checklist

Source: all six pages of the Webtezza assessment PDF, read 2026-10-05. The PDF is the assessment specification; the pasted user request controls implementation and publishing authorization. Check boxes indicate verified completion, not merely code written.

| ID | Source | Requirement | Implementation / verification |
|---|---|---|---|
| R01 | PDF 1–2 | Only production batch verification and sewing gate; persistent full-stack app | Pending |
| R02 | PDF 2,4 | Authenticated three roles, visible demo credentials, server separation of duties | Pending |
| R03 | PDF 3 | Exact REC-BL01 and REC-CT02 recipes, categories, five components each, fabric and caps | Pending |
| R04 | PDF 3 | Recipe, whole target quantity, roll ID, actual yards; immediate expected multipliers | Pending |
| R05 | PDF 2–3 | Cutting preparation, pending submission, verified approval, reasoned rejection and correction | Pending |
| R06 | PDF 3–4 | Green match, yellow excess allowed, red shortage blocks UI and API (422) | Pending |
| R07 | PDF 4 | Missing/uncounted blocks; non-verifier approval 403; server session identity/time | Pending |
| R08 | PDF 2,4 | Immutable persisted approval audit: verifier, timestamp, variances, wastage | Pending |
| R09 | PDF 3–4 | Sewing database query WHERE status=VERIFIED; counts, attribution, assembly action | Pending |
| R10 | PDF 3 | Wastage=((actual−expected)/expected)*100; expected=quantity*standard yards | Pending |
| R11 | PDF 4 | Users, recipes, components (optional image), orders, verification items and logs, relational constraints | Pending |
| R12 | PDF 4 | Five mandatory tests: green approval, red block, reason required, role 403, queue isolation | Pending |
| R13 | PDF 5–6 | High contrast inputs/dropdowns/focus, responsive UI, inline errors; persistence on reload | Pending |
| R14 | PDF 5 | Reject negative, fractional counts, nonnumeric and empty inputs | Pending |
| R15 | PDF 5 | AI report: tools/prompts, >=2 genuine flawed-code findings, refactoring attribution, architecture | Pending |
| R16 | PDF 5 | Four-day milestone plan (28–32 hours) | IMPLEMENTATION_PLAN.md |
| R17 | PDF 6 | Public cloud URL, public GitHub, actual iterative commits | Local preparation first; account access later |
| R18 | PDF 6 | README architecture/schema/demo credentials; passing executable tests | Pending |
| R19 | User | Next.js/TypeScript/Tailwind/PostgreSQL/Prisma, secure password hashing, env example/no secrets | Pending |
| R20 | User | Exact component set, reject duplicates/unknown/malformed values; ignore no client authority | Pending |
| R21 | User | Atomic approval/audit, concurrent request protection, historical attempts | Pending |
| R22 | User | Extra integration tests; isolated test DB; typecheck/build/browser all roles | Pending |
| R23 | User | Documentation/deployment preparation, explanation and final requirement report | Pending |

## Explicit seed specification

- Casual Blouse / REC-BL01 / Blouse: 1.8 yards, 5% cap. Front Body Panel 1; Back Body Panel 1; Sleeves (Left & Right) 2; Collar & Stand 1; Sleeve Cuffs 2.
- Crop Top / REC-CT02 / Crop Top: 1.1 yards, 8% cap. Front Chest Panel 1; Back Support Panel 1; Neck Binding Strip 1; Hem Elastic Casing 1; Side Strap Accents 2.

## Assumptions and decisions

- Positive decimal fabric yards are allowed because the supplied recipes use fractional yards. Garment/component counts must be whole integers. Actual components may be zero (a shortage).
- Wastage above the recipe cap is a warning, not a separate approval block. Negative calculated wastage is retained by the specified formula.
- Assembly uses a separate server timestamp while status remains VERIFIED, preserving the literal queue database filter and immutable QC decision.
- Recipes are seeded and read-only in this module; no recipe editing endpoint is necessary.
- Rejected orders may be corrected and resubmitted; historical decision snapshots remain immutable.
- PDF day-one cloud deployment is deferred per the user's explicit local-preparation-first instruction.

## Task checklist

- [x] Read complete specification and inspect empty workspace.
- [x] Record requirements and practical four-day plan.
- [ ] Implement schema, authentication, seeds and migrations.
- [ ] Implement protected workflow and responsive role workspaces.
- [ ] Run integration tests, typecheck, build and browser walkthrough.
- [ ] Complete README, AI findings, local commits and completion report.
- [ ] Publish repository and deploy (requires account access).
