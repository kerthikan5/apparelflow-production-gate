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

I used Codex as an AI-assisted engineering tool and reviewed the resulting architecture, test evidence, security boundaries, and deployed behavior before submission. I did not treat generated code as correct merely because it compiled.

The review retained and validated these concrete refactors:

1. The original assembly-action validation checked the supplied version before hiding an unverified batch. That ordering could reveal that an inaccessible order existed. The check was reordered so a Sewing Supervisor receives 404 for an unverified batch before version validation. A regression test now covers this behavior.
2. The original verification-decision code did not narrow the TypeScript payload safely. It was rewritten to parse the decision payload separately rather than suppressing the compiler with a cast. Type checking then passed without weakening types.
3. The original logout flow reused a mutation helper that refreshed protected data after revoking the session. The helper gained an explicit refresh option, and logout now clears role data without issuing an unnecessary authenticated request.
4. A PowerShell edit introduced corrupted Unicode labels. The file was repaired with explicit UTF-8 handling, formatted, and scanned for the corrupted sequences.

I also reviewed the final domain safeguards and verified why they are needed:

- Authentication roles come from database-backed server sessions. Browser state never grants permission.
- Expected counts are recalculated from stored recipes and the stored batch quantity. Expected counts, roles, timestamps, wastage, and status are not accepted from the client.
- Approval, final component counts, audit creation, and the VERIFIED transition execute in one transaction so partial approval cannot be stored.
- A PostgreSQL row lock serializes changes to one batch, while the version field rejects stale browser requests. The combination protects both concurrent and delayed submissions.
- Database constraints and triggers protect approved counts, audit logs, batch details, and the assembly timestamp from later modification.
- The Sewing Queue uses a server-owned `status = VERIFIED` database predicate. URL parameters cannot replace that filter.
- Role checks run before action payload validation, so unauthorized callers receive 403 without learning validation details.

I validated these decisions through the integration suite, TypeScript checking, a production build, direct PostgreSQL immutability attempts, concurrent approval tests, GitHub Actions, and an authenticated smoke test against the deployed Vercel application and hosted database. Codex assisted with implementation and debugging; I remained responsible for reviewing the evidence, understanding the safeguards, and deciding whether the result met the assessment specification.

## 4. Defensive architecture

Server-owned sessions and roles; explicit action endpoints rather than generic status updates; exact component-set validation; expected counts derived from stored recipes; atomic guarded state transitions and immutable audit snapshots; database-filtered verified-only sewing access. Decimal yards versus integer counts is an explicit specification assumption.

The relational migration also enforces one approval per order, consistent count/status values and append-only history. All historical attempts are preserved when current items are replaced during correction. Assembly uses a separate immutable timestamp so the SQL queue predicate stays exactly `status = VERIFIED`. Source palette checks passed, but rendered contrast and mobile layout are not claimed as verified. Local Git commits reflect actual work rather than invented daily activity.
