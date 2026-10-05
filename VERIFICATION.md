# Verification record

Verification date: 2026-10-05. The project is connected to the public GitHub repository and deployed at `https://apparelflow-production-gate.vercel.app`. The deployment returned HTTP 200 and passed the reusable remote workflow test.

| Check | Result | Evidence / scope |
|---|---|---|
| Complete PDF reading | PASS | All six pages extracted and read; requirements recorded |
| PostgreSQL migrations | PASS | Both migrations applied to development and isolated test databases |
| Seed command | PASS | Three hashed-password accounts and two recipes persisted |
| HTTP integration suite, development server | PASS | 15 tests, 0 failures, 0 skipped; real Next.js server + PostgreSQL before the exact-recipe regression test was added |
| TypeScript | PASS | `npm run typecheck`, after fixing genuine generated-code errors |
| Production build | PASS | `npm run build`; compiled routes `/` and `/api/[...path]` |
| Source color contrast | PASS | Seven palette pairs >=4.5:1; results below |
| Final production-server integration run | PASS | `TEST_PRODUCTION=1 npm test`: 16 passed, 0 failed, 0 skipped against built Next.js and PostgreSQL; includes exact recipe regression |
| Browser workflow / screenshots | NOT VERIFIED | `cua.listBrowsers()` returned no browsers; in-app and Chrome creation both reported unavailable |
| Responsive layout, rendered focus and dropdowns | NOT VERIFIED | CSS implemented, but no connected browser for visual inspection |
| GitHub Actions | PASS | Public API reports `Verify production gate` run 37299781039 completed successfully on `main` |
| Hosted PostgreSQL / HTTPS / public URL | PASS | Vercel URL returned HTTP 200; authenticated production workflow passed against the hosted database |

## Deployed backend verification

`BASE_URL=https://apparelflow-production-gate.vercel.app npm run test:remote` passed against the production Vercel deployment and Neon database. It authenticated all three roles; confirmed non-verifier approval returns 403; confirmed shortage, missing-count, and blank-reason requests return 422; excluded rejected and pending orders from the Sewing Queue; corrected and resubmitted a rejection; persisted a Yellow count across a fresh request; approved Yellow; preserved rejection and approval audit history; started assembly; confirmed assembly persisted; and rejected a repeated start with 409. The run creates clearly labeled `REMOTE-*` demo batches, including an intentionally pending batch.

## Contrast measurements

`node scripts/contrast.mjs`: input/dropdown 14.74:1; placeholder 4.84:1; readonly input 8.58:1; primary button 7.18:1; green label 6.02:1; yellow label 5.69:1; red label 6.14:1. These values test the declared foreground/background palette, not rendered browser states.

## Environment issues resolved

The workspace was empty. Python's default app alias was unusable; an installed Python interpreter and pypdf were used to read the PDF. npm initially failed with connection resets; dependencies eventually installed through a registry mirror. A stalled write was inspected before continuing. Prisma needed its engine download outside the sandbox. TypeScript execution in the sandbox failed resolving the OS user; the approved local execution path worked. No existing user project files were overwritten.

## Remaining evaluator checks

Run the README's five-minute demonstration in a connected browser, inspect every form/dropdown at desktop and narrow widths, check keyboard navigation, refresh after saving counts and starting assembly, then repeat on the final HTTPS deployment. Review code and AI findings personally before submission.
