---
name: architecture-guidelines
description: >-
    First-principles architectural rules: minimalism (YAGNI, Rule of 3, DRY),
    modularity (SoC, SRP, interface discipline, dependency inversion), functional
    core (pure domain logic, I/O at the edges), resilience (fail-fast,
    idempotency, atomicity, failure classification), domain-driven naming, and
    concurrency on shared mutable state. TRIGGER when: introducing a new
    module/service/abstraction, refactoring across module boundaries, applying
    SOLID, or reviewing a PR for architectural concerns. SKIP for: bug fixes
    within an existing module, content/copy edits, CSS-only changes, dependency
    bumps, trivial renames.
---

# Architectural Discipline (First Principles)

> **Core Directives**
>
> - **Patternization**: A unified, simpler whole beats a fragmented system of locally perfect solutions.
> - **Minimalism**: Smallest viable solution. ZERO speculative extensibility.
> - **Traceability**: Names reflect architectural layer, domain role, and technical purpose.
> - **Dependency Discipline**: Graphs MUST be directed, acyclic, shallow. Cycles forbidden.

## 1. Minimalism & Abstraction

- **YAGNI**: No speculative features or extensibility hooks.
- **Rule of 3**: Wait for three proven instances before abstracting. Prefer copying < 20 lines over premature abstraction.
- **DRY (knowledge, not shape)**: A business rule, constant, or schema has exactly one authoritative representation.
- **Frame-check before execute**: When a spec prescribes implementation steps, run the necessity gate from `functionality-complexity-tradeoff` §1 first — does this problem actually exist in this stack?

## 2. Consistency & Coupling

- **Full Migration**: When adopting a new pattern, migrate all sibling components in the same PR.
- **Dependency Inversion**: Domain logic depends on abstractions, never concrete implementations.

## 3. Functional Core

- **Pure Domain Logic, I/O at the Edges**: Business logic is pure, side-effect free, environment-agnostic.
- **Testability**: A pure core is unit-testable without mocks. If the domain needs mocks, purity has been violated.

### BOM application
`src/lib/permissions.ts`, `src/lib/crypto.ts`, and `src/lib/validations.ts` are the functional core — pure TypeScript, no Next.js specifics. API routes are the I/O edge. Keep it that way.

## 4. Modularity

- **SoC**: One concern per module; cross-cutting concerns are extracted, not interleaved.
- **SRP**: One reason to change per module. Two forces of change → split.
- **High Cohesion, Loose Coupling**: Internals tightly related; external dependencies minimized and abstracted.
- **Interface Discipline**: Depend on the contract, never the implementation.

## 5. Resilience

- **Fail Fast**: Validate and sanitize inputs at all system or atomicity boundaries (Zod on all API routes ✓).
- **Idempotency**: Safe under repeated execution; succeeds when the desired state already holds.
- **Failure Classification**: Categorize each external call as **hard** (blocks) or **best-effort** (logged) before implementation.
- **Atomicity**: Decide whether partial success is acceptable or rollback is required.
- **State Visibility**: Log decision and outcome at each step.

## 6. Naming & Traceability

- **Domain-Driven Names**: Every function, variable, directory reveals architectural layer, domain role, and purpose. `utils` / `helpers` fail this test.
- **Self-Documenting Structure**: Directory and filename alone should reveal architectural boundaries.

## 7. Concurrency & Shared Mutable State

- **Zustand store** (`src/store/`) is client-side per-tab — document in JSDoc.
- If state is modified after an `await`, ask: _"is this guarded against concurrent mutation?"_

> [!IMPORTANT] **Complexity Warning**: If a solution violates any guideline above, state:
> _"Complexity Warning: introduces [X]. A simpler alternative is [Y]."_
