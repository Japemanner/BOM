---
name: system-optimization
description: >-
    Applies Lean, Kaizen, Six Sigma, Theory of Constraints, and DevOps principles
    to eliminate waste and improve flow. Use when scanning for optimizations in
    CI/CD pipelines, developer workflows, code structure, testing strategy,
    documentation, or the overall value stream. Activate when a review is
    requested to identify waste, bottlenecks, and improvement opportunities.
---

# System Optimization Protocol

> **Core Directives**
>
> 1. **Eliminate Waste First (Lean)**: Remove non-value-adding activities before optimizing what remains.
> 2. **Fix the Constraint (ToC)**: The weakest link sets the throughput ceiling. Find it; subordinate everything else.
> 3. **Stabilize Before Optimizing (Six Sigma)**: An unstable process cannot be meaningfully improved.
> 4. **Build Quality In — Shift Left (DevOps)**: Embed quality at the source via automation, types, and linting.
> 5. **Small Steps (Kaizen)**: Many small validated improvements compound faster than infrequent large redesigns.
> 6. **Decide Late (Lean)**: Defer irreversible commitments until you have the most information.

---

## Order of Operations

Apply **in order** — automating something that should be deleted is work to undo later.

1. **Question the requirement.** Strip to first principles; the cheapest step is the one that no longer needs to exist.
2. **Delete it.** Try removing the step, file, stage, or component entirely.
3. **Simplify what remains.** Only optimize parts that survived deletion.
4. **Speed it up.** Parallelize, cache, batch — only after simplification.
5. **Automate last.** Automating an unsimplified process locks in the waste.

## 1. Scan Layers

| Layer                      | Red flags                                                           |
| -------------------------- | ------------------------------------------------------------------- |
| **CI/CD & Automation**     | Sequential stages that could parallelize, manual steps, flaky gates |
| **Developer Workflow**     | Large PRs, long-lived branches, slow feedback loops                 |
| **Code Structure**         | Dead code, duplication, divergent patterns                          |
| **Testing Strategy**       | Coverage gaps, flaky tests, defects caught late                     |
| **Tooling & Dependencies** | Unused packages, outdated tooling, manual steps                     |
| **Documentation**          | Stale docs, missing ADRs, over-documentation                        |
| **Observability**          | Missing metrics, silent failures, unclear alerts                    |

## 2. Waste Scan (Lean — TIMWOODS)

| Waste               | In Software                    | BOM red flag                                       |
| ------------------- | ------------------------------ | -------------------------------------------------- |
| **Transport**       | Unnecessary artifact movement  | Manual steps between tools                         |
| **Inventory**       | Unprocessed work in queues     | Stale PRs, unread alerts                           |
| **Waiting**         | Idle time between steps        | `typecheck` + `lint` run sequentially              |
| **Overproduction**  | More than consumed             | Unused logs, generated files                       |
| **Overprocessing**  | More steps than value requires | Manual quality gates that should be automated      |
| **Defects**         | Errors requiring rework        | Architecture violations caught only in code review |
| **Skills (unused)** | Underutilized capability       | Manual tasks that could be automated               |

## 3. Constraint Identification (ToC — 5 Steps)

1. **Identify** the single step with lowest throughput.
2. **Exploit** — maximize its output without adding resources.
3. **Subordinate** — ensure upstream steps don't feed it faster than it can consume.
4. **Elevate** — if still a bottleneck, invest in capacity.
5. **Repeat** — a new constraint always emerges.

### BOM current constraints
- **Constraint 1**: No automated quality gate — `typecheck` and `lint` are manual. Architecture violations only surface in code review.
- **Constraint 2**: All testing is E2E Playwright — slow feedback loop. Pure lib functions (canDo, crypto, validations) have no unit tests.
- **Next after fixing these**: migration dry-run gate before deploy.

## 4. Diagnostic Reasoning Chain

- **First Principles**: Strip legacy assumptions. Rebuild from objective truth.
- **Inversion**: "How do I guarantee failure?" — then build guardrails against it.
- **Simple Functional Refactor Over Complex Technical Solution**: Prefer reasonable functional changes before technical solutions.
- **Pre-mortem**: Assume the fix already failed; work backward to find the oversight.
- **Side Effect Audit**: When eliminating redundancy, trace all downstream paths.
- **Pattern Parity**: Never let divergent legacy patterns coexist with a newly established standard.

## 5. CI/CD

- **Bottleneck first (ToC)**: Optimize the slowest stage before anything else.
- **Parallelize aggressively**: Tests, builds, and linting run concurrently, never sequentially.
- **Idempotent environments**: Deployment state must be reproducible from source control.
- **Shift-left gates**: Linting and unit tests run before integration tests.
- **Zero-downtime secret rotation**: Create new credential first, apply everywhere, then delete old one.

## 6. Developer Workflow

- **Small PRs**: Faster merge, smaller blast radius, better review quality.
- **Short feedback loops**: Fast local test results reduce context-switching cost.
- **Eliminate toil**: Any recurring manual task that can be automated must be automated.

## 7. Testing

- **Detection distance**: Bugs caught closest to their source are cheapest. Unit > integration > e2e.
- **Flakiness is a defect**: A flaky test erodes trust and masks real failures.
- **Confidence over coverage**: Optimize for critical-path confidence, not line percentages.

## 8. Documentation

- **Executable specs over text**: Tests and self-documenting code are living documentation.
- **ADRs**: Document _why_, not _what_. Store in `/decisions/`.

## 9. Litmus Test

> If a change worsens any complexity axis (D, K, P, n) from `structural-simplification`
> without improving another, it is not an optimization.
