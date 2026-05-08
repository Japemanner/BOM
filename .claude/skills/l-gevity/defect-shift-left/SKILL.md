---
name: defect-shift-left
description: >
    Places every error detection at the earliest stage of the pipeline that is
    technically capable of catching it. Use when designing or auditing a CI/CD
    pipeline, choosing tooling, deciding where a check belongs, or asking "could
    this have been caught earlier?"
---

# Defect Shift-Left

> Pipeline stages have a strict order. Every defect has an earliest stage at
> which it can be caught. Catching it later is always a regression.

> **Directives**
>
> 1. **Prevent over detect.** Make invalid states unrepresentable before adding a check.
> 2. **Earliest possible stage is mandatory.** If a check _can_ run at stage N, running it at N+1 is a regression.
> 3. **Replace, don't layer.** When shifting a check earlier, remove the later one.
> 4. **Fail loud at the origin.** Errors must surface where they originated.

---

## 1. The Ladder

| Stage  | Phase                   | What runs here                                                            |
| ------ | ----------------------- | ------------------------------------------------------------------------- |
| **0**  | Language                | Type system, syntax, language semantics                                   |
| **1**  | Design                  | Spec, ADR, threat model, schema                                           |
| **2**  | Authoring               | LSP, in-editor lint, formatter                                            |
| **3**  | Pre-commit              | Format, fast lint, secret scan, commit-msg hook                           |
| **4**  | Compile                 | Compiler, type-checker, codegen                                           |
| **5**  | Build / Static analysis | Full lint, depcheck, SAST, license, CVE, bundle, fitness functions        |
| **6**  | Unit test               | Local test runner, property tests                                         |
| **7**  | Integration / Contract  | CI suite, contract tests, container builds                                |
| **8a** | Pre-deploy static       | Migration dry-run, config-vs-env, capacity _(deploy abortable)_           |
| **8b** | Deploy execution        | Smoke, health probes, slot readiness _(rollback on failure)_              |
| **9**  | Canary / Staging        | Partial traffic, real env, perf regression                                |
| **10** | Production runtime      | Live traffic, monitoring                                                  |
| **11** | Post-incident           | Forensics, RCA                                                            |

## 2. BOM pipeline audit (current state)

| Stage | What exists in BOM          | Gap                                          |
| ----- | --------------------------- | -------------------------------------------- |
| 0     | TypeScript strict mode ✓    | `noUncheckedIndexedAccess` not enabled       |
| 1     | architecture_rules.md ✓     | Not machine-enforced (prose only)            |
| 2     | ESLint ✓                    | No architecture boundary rules yet           |
| 3     | —                           | No pre-commit hooks (husky/lefthook missing) |
| 4     | `npm run typecheck` ✓       | Not a blocking gate (manual only)            |
| 5     | `npm run lint` ✓            | No import-boundary enforcement               |
| 6     | —                           | No unit tests at all                         |
| 7     | Playwright E2E ✓            | Only late-stage detection                    |
| 8a    | —                           | No migration dry-run gate                    |
| 8b    | Coolify deploy ✓            | No smoke test post-deploy                    |
| 10    | —                           | No runtime monitoring / error tracking       |

**Priority gaps (Δstage × frequency):**
1. Architecture boundary rules at Stage 5 (see `architecture-as-code-javascript`)
2. Pre-commit hooks at Stage 3 (typecheck + lint on staged files)
3. Unit tests at Stage 6 (pure lib functions: `canDo`, `crypto`, `validations`)
4. Runtime error tracking at Stage 10

## 3. Defect Taxonomy → Earliest Stage

| Defect class                            | Stage | Mechanism                                       |
| --------------------------------------- | ----- | ----------------------------------------------- |
| Type mismatch, null deref               | 0     | TypeScript                                      |
| Forbidden architectural dependency      | 1→5   | ADR (else eslint-plugin-boundaries)             |
| Authorization model gap                 | 1     | Threat model (else 7: security test)            |
| Schema / contract mismatch              | 0     | Zod (already in place ✓)                        |
| Style, formatting, unused code          | 2     | LSP / editor (else 5: lint)                     |
| Logic error in pure function            | 6     | Unit test                                       |
| Integration boundary mismatch           | 7     | Playwright E2E (currently only option)          |
| Migration vs current schema             | 8a    | Dry-run against prod DB                         |

## 4. The Algorithm

1. **Inventory** every check and the stage it runs at.
2. **Classify** each by defect class (§3).
3. **Compute Δstage** = current − earliest possible.
4. **Prioritize** by Δstage × frequency.
5. **Move the check** to the earlier stage.
6. **Verify and remove** the later check once the earlier one is proven.
7. **Every escaped defect is a forced audit:** find its earliest possible stage.

## 5. Anti-Patterns (active in BOM)

| Pattern                              | Stage actual / earliest |
| ------------------------------------ | ----------------------- |
| Architecture rules in prose only     | 11 (escaped) / 1 + 5   |
| No pre-commit hooks                  | 5 / 3                   |
| No unit tests for pure lib functions | 7 / 6                   |
| Manual typecheck (not a gate)        | manual / 3              |

## 6. Decision Protocol

1. Identify the defect class.
2. Look up earliest possible stage.
3. Compare to current/proposed stage.

| Situation                                 | Action                                         |
| ----------------------------------------- | ---------------------------------------------- |
| Proposed = earliest possible              | Proceed                                        |
| Proposed > earliest, earlier feasible now | Reject — implement at the earlier stage        |
| Proposed > earliest, requires effort      | Document gap as technical debt; schedule shift |
