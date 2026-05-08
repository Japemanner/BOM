---
name: geometric-architecture
description: >-
    A 3-D spatial coordinate system for the dependency graph. Every component is
    given an address (X = domain, Y = abstraction level, Z = depth), coupling is
    restricted to face-adjacent neighbors, and connection direction is encoded
    by which face links to which. Long-range and cyclic connections become
    structurally expensive instead of merely discouraged. TRIGGER when: deciding
    where a new module/service/layer lives, designing or refactoring the
    dependency graph, diagnosing layer/cycle/god-object/cross-domain tangles, or
    configuring dependency-guard lint rules. SKIP for: routine business logic
    inside an existing module, bug fixes, CSS-only changes, dependency bumps.
---

# Geometric Software Architecture

Place every component at an address `(X, Y, Z)` in a 3-D grid; allow coupling
only to face-adjacent neighbors. The medium itself resists long-range and cyclic
connections — the way a building's geometry resists impossible plumbing.

## 1. Three axes (orthogonal concerns)

| Axis | Encodes                     | Direction                                                              |
| ---- | --------------------------- | ---------------------------------------------------------------------- |
| Z    | depth (environment / layer) | consumer (Z=0) → infrastructure (Z=N). Dependencies flow Z-increasing. |
| X    | domain / bounded context    | one column per business domain.                                        |
| Y    | abstraction level           | orchestrators (top) → primitives (bottom).                             |

Same X = same domain. Same Y = same abstraction tier. Same Z = same layer.

## 2. Six faces (directionality)

Every cell exposes six faces with fixed semantic roles:

- **Front** — public interface; the only valid face for incoming calls.
- **Back** — outward calls / I/O / infrastructure access.
- **Top** — receives orchestration from above.
- **Bottom** — delegates to primitives below.
- **Left / Right** — same-tier neighbors (cross-domain siblings).

A connection is valid only when **A's Back connects to B's Front**. Cycles are
impossible without one connection crossing a face the wrong way.

## 3. BOM layer map

```
Z=0  Browser / UI         src/app/(dashboard)/**   src/app/(auth)/**
Z=1  Components           src/components/**
Z=2  API Routes           src/app/api/**
Z=3  Business Logic       src/lib/**  (excl. permissions)
Z=4  Access Control       src/lib/permissions.ts
Z=5  Data / ORM           src/db/**
Z=6  Database Schema      src/db/schema/**
```

X-domains:
- `assistants` — assistant management
- `auth` — authentication & session
- `iam` — tenancy & membership
- `rbac` — roles & permissions
- `webhooks` — inbound/outbound webhook flows
- `rag` — knowledge sources & documents
- `review` — inbox / review items

**Valid dependency directions:** Z-increasing only. No Z-skips (wormholes).
No X-crossing at schema level (rbac.* ↔ app.* coupling must go via lib/).

## 4. Failure modes the geometry rules out

| Failure mode          | Geometric fix                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------- |
| Long-range coupling   | Locality: distance costs. A→C skipping B forces building B and naming the chain.          |
| Circular dependencies | Face directionality: cycles require a back-to-back face, which is invalid.                |
| Layer violations      | Z-axis + face: ΔZ > 1 is a wormhole. UI cannot reach DB without traversing each layer.    |
| God objects           | All six faces occupied → decompose along the axis with the most edges.                    |
| Hidden shared state   | Phantom-neighbor rule: implicit coupling must be promoted to a real cell with an address. |

## 5. What emerges for free

- Strict Z-flow → **Clean / Hexagonal architecture**: domain logic isolated from infrastructure.
- Independent X-columns → **DDD bounded contexts** and correct microservice cuts.
- Y-stratification → **layered abstractions**: each level knows only the level immediately below.
- Locality → **bounded reasoning surface**: at most six neighbors per cell.

## 6. Mechanical enforcement (ESLint)

See `architecture-as-code-javascript` for the implementation.

| Geometric rule                        | Mechanism                        |
| ------------------------------------- | -------------------------------- |
| rbac.* only via permissions.ts        | `boundaries/dependencies` rule   |
| Components don't import DB directly   | `boundaries/dependencies` rule   |
| No circular imports                   | `import/no-cycle` (eslint-plugin-import) |

**Rollout:** add every rule at `warn`. Promote to `error` only after violations clear.

## 7. Review checklist

When reviewing a PR that touches module boundaries:

- [ ] New module placed at correct Z-level?
- [ ] No Z-skip (wormhole) imports introduced?
- [ ] No cross-X coupling at schema level?
- [ ] `rbac.*` only accessed via `permissions.ts`?
- [ ] New domain entity placed in correct X-column?
