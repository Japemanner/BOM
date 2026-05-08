---
name: functionality-pruner
description: >-
    A first-principles framework for deciding whether a piece of functionality
    is (a) addressing a problem that exists in this context and (b) worth its
    complexity cost. Applies to two modes: prospective (should we build this?)
    and retrospective (should we keep this existing code?). Use this skill
    when evaluating whether to build, defer, drop, keep, simplify, delete, or
    remove-as-obsolete a capability — weighing necessity, value delivered,
    and maintenance/bug-surface/evolution-tax cost. Trigger whenever the user
    asks "is this worth building?", "should we remove this code?", "is this
    complexity justified?", or is otherwise weighing scope or necessity against
    engineering cost.
---

# Functionality pruner

> This skill governs **decisions about whether functionality justifies its
> existence**. It runs in two stages: a **necessity gate** (does the problem
> this code addresses actually occur in this context?) followed by a **worth
> ledger** (does the value justify the cost?).

> **Core Directives**
>
> 1. **Necessity precedes worth.** Code guarding against impossible states has zero value. Skip the worth ledger and emit OBSOLETE.
> 2. **Separate the ledger.** Value and cost are distinct axes.
> 3. **Cost compounds, value decays.** Evaluate over the feature's expected lifetime.
> 4. **The default is No.** YAGNI is the null hypothesis.
> 5. **Build and audit share a model.** Same axes apply to adding or removing.
> 6. **Delete over refactor, refactor over rewrite.**

---

## 1. The Necessity Gate

Before scoring V and C, confirm the problem itself exists in this stack. If not: emit **OBSOLETE** (retrospective) or **DROP** (prospective).

### Categories of non-problem-solving code

| Category                          | Definition                                                    | Typical BOM example                                        |
| --------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------- |
| **Impossible-state guard**        | Defends against a state ruled out by the architecture         | Null-guard on tenantId when middleware guarantees it       |
| **Already-defended-elsewhere**    | Concern fully owned by a different layer                      | Manual CSRF token on an endpoint behind Better Auth        |
| **Cargo-culted pattern**          | Pattern whose prerequisites do not hold here                  | Connection pool in a one-shot script                       |
| **Phantom requirement**           | Solves a requirement that was never real or has lapsed        | Feature flag for a completed launch                        |
| **Generality without instantiation** | Abstraction with no second concrete user                   | Strategy pattern with one assistant type                   |
| **Logically dead branch**         | Branch unreachable given upstream contracts                   | `if (!tenantId)` after `getSessionContext()` guarantees it |

### Detection heuristics (run BEFORE scoring V or C)

- **Invariant audit** — list invariants the middleware/auth/session layer maintains; branches contradicting those are dead.
- **Trigger reachability** — construct a concrete sequence that activates the code without violating architectural invariants.
- **Origin archaeology** — pull the introducing commit; verify the rationale's premises still hold.
- **Layer-responsibility map** — for each cross-cutting concern, name the single layer that owns it.

---

## 2. The Worth Model

### Value axes (0–3 scale)

| Axis                 | Symbol | What it measures                                         |
| -------------------- | ------ | -------------------------------------------------------- |
| **Utility**          | `U`    | Severity of the user need; what breaks without it        |
| **Frequency**        | `F`    | How often the need arises per affected user              |
| **Reach**            | `R`    | Proportion of users/flows that encounter the need        |
| **Irreplaceability** | `I`    | Cost of the next-best alternative                        |

### Cost axes (0–3 scale)

| Axis              | Symbol | What it measures                                        |
| ----------------- | ------ | ------------------------------------------------------- |
| **Maintenance**   | `M`    | Tests, docs, reviews the feature demands                |
| **Risk**          | `X`    | Bug surface × blast radius                              |
| **Evolution tax** | `E`    | Degree to which the feature constrains future change    |

Plus structural cost from `structural-simplification`: ΔD, ΔK, ΔP, Δn.

---

## 3. Decision Protocol

1. **Run the necessity gate** (§1). Walk the heuristics. If fails → OBSOLETE/DROP.
2. **Score V axes** (U, F, R, I) with one-line evidence each.
3. **Score C axes** (ΔD, ΔK, ΔP, Δn from structural-simplification; M, X, E).
4. **Record confidence** (Low/Medium/High) for each side.
5. **Apply the Worth Matrix:**

|              | **Low C**            | **Medium C**             | **High C**       |
| ------------ | -------------------- | ------------------------ | ---------------- |
| **High V**   | BUILD / KEEP         | BUILD / KEEP             | NEGOTIATE        |
| **Medium V** | BUILD-minimal / KEEP | BUILD-minimal / SIMPLIFY | DEFER / SIMPLIFY |
| **Low V**    | DEFER / QUARANTINE   | DROP / SIMPLIFY          | DROP / DELETE    |

---

## 4. Verdicts

### Prospective
- **BUILD** — proceed; record worth rationale.
- **BUILD-minimal** — smallest slice capturing ≥80% of V; defer the rest.
- **NEGOTIATE** — high V, high C: reduce scope or accept debt with expiry date.
- **DEFER** — V unclear; document trigger conditions.
- **DROP** — doesn't clear the cost bar, or fails necessity gate.

### Retrospective
- **KEEP** — worth is positive; document why.
- **SIMPLIFY** — worth positive but C inflated; apply structural-simplification operations.
- **QUARANTINE** — V unmeasured; add telemetry, revisit after N weeks.
- **DEPRECATE** — marginal worth; announce, migrate, remove on schedule.
- **DELETE** — negative worth, removal feasible.
- **OBSOLETE** — necessity gate fails; delete without scoring worth.

---

## 5. Output Contract

```
Subject:        <feature / module / ticket / path under review>
Mode:           Prospective | Retrospective
Necessity:      Pass | Fail
Necessity note: <category from §1, one line>
V scores:       U=<0-3>  F=<0-3>  R=<0-3>  I=<0-3>  (evidence per axis)
C scores:       ΔD=<±n>  ΔK=<±n>  ΔP=<±n>  Δn=<±n>  M=<0-3>  X=<0-3>  E=<0-3>
Confidence V:   Low | Medium | High
Confidence C:   Low | Medium | High
Verdict:        <from §4>
Rationale:      <2–4 sentences>
Minimal alt:    <smallest slice preserving most V, if applicable>
Revisit when:   <measurable trigger or date — REQUIRED for DEFER/QUARANTINE/BUILD-minimal>
```
