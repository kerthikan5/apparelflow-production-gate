# AI optimization report

## 1. Tools and prompting

Codex is implementing this module with the user as reviewing engineering partner. Tasks include specification extraction, schema and API design, UI, tests and documentation. PowerShell, Git, Python/pypdf, npm and official framework documentation support the work. The user supplied detailed security and verification constraints. No AI work is represented as personally authored or reviewed by the candidate.

## 2. Flawed / broken AI code

### Finding 1: hidden-batch existence leaked by validation order

The first `actOnOrder` implementation checked the supplied version before checking whether an assembly target was verified. A sewing user could send a stale version for an unapproved order and receive 409, while a nonexistent order returned 404. This did not expose the record body, but it leaked existence and violated the intent of queue isolation.

Codex found this in code review and moved the verified-status check ahead of the version check for assembly. The HTTP regression test named `invalid transitions blocked; assembly cannot disclose hidden orders through stale version` checks that an unverified batch with version 999 returns 404. The test passed. This was an AI correction, not a claim of human refactoring.

### Finding 2: incorrect TypeScript narrowing in decision handling

The first code assigned either a count payload or a decision payload to `parsed`, then used `'decision' in parsed`. Because the count schema's shape was a structural subset, TypeScript narrowed the property to `unknown` and could not safely access `rejectionNote` or assign `decision` to the Prisma enum. The actual type check reported TS2339 and TS2322.

Codex changed this to a separately parsed `decision` value (or null) and used `decision ?? countsInput.parse(input)` for shared count processing. This preserves the validated decision type instead of silencing the compiler with a cast. Type checking and the expanded 16-test HTTP suite then passed. A missing closing brace in the generated include object was also corrected before that passing check.

### Finding 3: logout reused the protected-refresh helper

The UI's generic `run` helper always refreshed the protected workspace after a mutation. Logout used that helper, so a successful logout immediately attempted an authenticated orders request using a now-revoked session. The result would show an unnecessary sign-in error. Codex identified this by tracing the source and added a `shouldRefresh` option, passing false for logout and clearing role-specific data. Type checking passed; browser confirmation remains outstanding because no browser was connected.

### Finding 4: an editing command corrupted Unicode labels

A Codex PowerShell edit read the UTF-8 UI file with the platform's default legacy encoding. A subsequent source check found mojibake in arrows, ellipses and separators. Codex reversed the encoding conversion with explicit encodings and verified the corrupted sequences were absent, then formatted the source. This is a real tooling mistake, not a fabricated application security finding.

## 3. Human refactoring and review

Candidate review is still pending. The changes above were made by Codex, not the candidate. The candidate should personally review `src/lib/workflow.ts`, `src/lib/security.ts`, the integrity migration, the test suite and the logout path before submission. In particular, explain why a row lock and version are both used, why a 403 role guard runs before payload validation, and why browser button state cannot authorize an approval. Do not submit this section as a claim of human work that has not happened.

## 4. Defensive architecture

Server-owned sessions and roles; explicit action endpoints rather than generic status updates; exact component-set validation; expected counts derived from stored recipes; atomic guarded state transitions and immutable audit snapshots; database-filtered verified-only sewing access. Decimal yards versus integer counts is an explicit specification assumption.

The relational migration also enforces one approval per order, consistent count/status values and append-only history. All historical attempts are preserved when current items are replaced during correction. Assembly uses a separate immutable timestamp so the SQL queue predicate stays exactly `status = VERIFIED`. Source palette checks passed, but rendered contrast and mobile layout are not claimed as verified. Local Git commits reflect actual work rather than invented daily activity.
