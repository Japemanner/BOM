---
name: structural-simplification
description: >-
    A domain-agnostic complexity model and decision protocol. Complexity is
    treated as a 4-axis vector — D (diversity), K (coupling), P (depth), n
    (quantity) — and any proposed restructuring is judged by its per-axis effect
    rather than by intuition. TRIGGER when: evaluating a refactoring, designing
    a restructuring, or deciding whether a proposed change makes a system simpler
    or more complex. SKIP for: trivial renames, content edits, dependency bumps,
    isolated bug fixes that touch no structure.
---

# Structural Simplification

> **Core Directives**
>
> 1. **Complexity has four axes**: D (diversity), K (coupling), P (depth), n (quantity).
> 2. **Compare before and after**: record ΔD, ΔK, ΔP, Δn before committing to any restructuring.
> 3. **Conform over customize**: reusing an existing pattern shrinks D globally.
> 4. **Delete over mitigate**: removing a part or special case beats handling it.
> 5. **If no axis improves while any worsens, it is not a simplification.**

---

## 1. The Complexity Model

| Axis          | Symbol | What it counts                                           |
| ------------- | ------ | -------------------------------------------------------- |
| **Diversity** | `D`    | Distinct patterns, shapes, or concepts in the vocabulary |
| **Coupling**  | `K`    | Relationship density: `edges / (n × (n−1))`              |
| **Depth**     | `P`    | Longest chain from source to sink                        |
| **Quantity**  | `n`    | Total number of parts                                    |

## 2. Heuristic Checks

| Check          | Signal                                                     |
| -------------- | ---------------------------------------------------------- |
| **Symmetry**   | Structure more uniform after → D↓                          |
| **Boundary**   | Fewer relationships crossing boundaries → K↓               |
| **Cycle**      | Dependency cycle broken → K↓                               |
| **Chain**      | Fewer hops source-to-sink → P↓                             |
| **Count**      | Fewer parts → n↓                                           |
| **Vocabulary** | Describable with fewer concepts → D↓                       |

## 3. Reduction Operations

### D↓ — Reduce Diversity
Unification, Normalization, Generalization, Abstraction, Symmetrization, Deduplication, Patternization.

### K↓ — Reduce Coupling
Encapsulation, Indirection, Inversion, Stratification, Cohesion, Temporal decoupling, Edge elimination.

### P↓ — Reduce Depth
Flattening, Inlining, Direct binding.
> **Warning:** A facade hides depth; it does not reduce it.

### n↓ — Reduce Quantity
Elimination, Merging.

## 4. Trade-off Matrix

| Restructuring         | D   | K   | P       | n   | Typical net      |
| --------------------- | --- | --- | ------- | --- | ---------------- |
| Add abstraction layer | ↑   | ↓   | ↑       | ↑   | Measure          |
| Flatten two layers    | —   | ↑   | ↓       | ↓   | Measure          |
| Extract common part   | ↓   | ↓   | —       | ↑   | Usually ↓C       |
| Bypass a layer        | —   | ↑   | ↓       | ↓   | Measure          |
| Add facade            | ↑   | —   | hides P | ↑   | Verify actual P  |
| Merge two modules     | ↓   | ↑   | ↓       | ↓   | Measure          |
| Split one module      | ↓   | ↓   | ↑       | ↑   | Measure          |

## 5. Decision Protocol

1. **Model** before-state. Record D₁, K₁, P₁, n₁.
2. **Model** after-state. Record D₂, K₂, P₂, n₂.
3. **Compare** per-axis deltas: ΔD, ΔK, ΔP, Δn.
4. **Classify**:

| Pattern                           | Action                          |
| --------------------------------- | ------------------------------- |
| All axes improve or hold          | Proceed                         |
| Mixed (some improve, some worsen) | Consult §4 trade-offs           |
| No axis improves                  | REJECT or redesign              |

> [!IMPORTANT] If no axis improves, state: _"Complexity Warning: ΔD [X], ΔK [Y], ΔP [Z], Δn [W]. A simpler alternative is [...]."_
