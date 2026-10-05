# AI optimization report

## 1. Tools and prompting

Codex is implementing this module with the user as reviewing engineering partner. Tasks include specification extraction, schema and API design, UI, tests and documentation. PowerShell, Git, Python/pypdf, npm and official framework documentation support the work. The user supplied detailed security and verification constraints. No AI work is represented as personally authored or reviewed by the candidate.

## 2. Flawed / broken AI code

Findings will be recorded only after genuine implementation defects are discovered and corrected. None recorded yet; the two-example assessment requirement is not yet satisfied.

## 3. Human refactoring and review

Pending candidate review. Changes made autonomously by Codex will be identified as AI corrections, not claimed as human refactoring. The candidate should review the linked fixes and explain them in their own words before submission.

## 4. Defensive architecture

Server-owned sessions and roles; explicit action endpoints rather than generic status updates; exact component-set validation; expected counts derived from stored recipes; atomic guarded state transitions and immutable audit snapshots; database-filtered verified-only sewing access. Decimal yards versus integer counts is an explicit specification assumption.
