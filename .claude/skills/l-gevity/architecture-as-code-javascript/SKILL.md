---
name: architecture-as-code
description: >-
    Pluggable mechanism for declaring and enforcing component boundaries via
    `.mjs` files in the source tree. Every module lives in a directory (or
    single file for a facade) and MAY ship an `eslint.architecture.mjs`
    declaring its components and rules. Files merge recursively: rules from
    higher levels accumulate. ESLint discovers them and builds one rule set. Use
    when: adding a module, splitting one, expressing a new dependency rule,
    debugging a forbidden edge, or extending the assembler. SKIP for routine
    edits inside a governed module. See `architecture-guidelines` for first
    principles, `geometric-architecture` for spatial rationale.
---

# Architecture-as-Code

> **Scope.** Describes the file format, discovery, and assembly that turn the
> directory tree into an enforced dependency graph. Runs as ESLint flat-config
> via `eslint-plugin-boundaries` — no ESLint, no enforcement. Does NOT prescribe
> what the graph should look like — that's `architecture-guidelines` and
> `geometric-architecture`.

> **TL;DR / Core Directives**
>
> 1. **Module = directory** (or a single file with `mode: 'file'`, e.g. a facade).
> 2. **One optional file per module** — `eslint.architecture.mjs`.
> 3. **A module knows itself, not its context.** Its own file governs internals
>    and outbound dependencies — never inbound ones.
> 4. **Composition lives on the level that does the composing.**
> 5. **Every module with rules ends with a catch-all bucket.**
> 6. **Recursion via discovery.** Assembler globs the tree; deeper files register first.

---

## 1. File schema

```js
export default {
    components: [ /* one entry per module */ ],
    forbidden:  [ /* dependency edges */    ],
};
```

## 2. Components

| Field     | Required | Purpose                                          |
| --------- | -------- | ------------------------------------------------ |
| `name`    | yes      | Module id referenced from `forbidden` edges.     |
| `pattern` | yes      | Glob selecting the directory; usually `<dir>/**`.|
| `mode`    | no       | `'file'` for single-file modules (facade).       |
| `capture` | no       | Segment captures, e.g. `['domain']`.             |

## 3. Forbidden edges

```js
{ from: <spec>, to: <spec>, except?: [...], except_to?: [...], why: '...' }
```

### BOM-specific rules to implement

The following architectural rules from CLAUDE.md / architecture_rules.md
MUST be encoded as forbidden edges:

```js
// rbac.* only accessible via permissions.ts
{ from: ['api', 'components'], to: 'rbac',
  why: 'Directe queries op rbac.* buiten src/lib/permissions.ts zijn niet toegestaan.' }

// app.* queries must always include tenant_id filter — lint cannot enforce this
// but the boundary (app.* only from api routes, never from components) can be.
{ from: 'components', to: 'db-schema-app',
  why: 'Components mogen niet direct db-schema-app importeren; gebruik API routes.' }
```

### Generic examples

```js
// Only the orchestrator may import the facade.
{ from: '*', except: ['orchestrator', 'core-*'], to: 'core-facade',
  why: 'Only the orchestrator may import the core facade.' }

// Core purity: no imports outside the core directory.
{ from: 'core-*', to: '*', except_to: ['core-*'],
  why: 'Core purity: no imports outside the core directory.' }
```

## 4. Where each rule lives

| Rule type                       | Lives in                 |
| ------------------------------- | ------------------------ |
| Afferent ("who may import me?") | Higher level (composer). |
| Efferent ("what may I import?") | Own file.                |
| Cross-module sibling-isolation  | Higher level (composer). |
| Internal layering               | Own file.                |

---

## 5. Setup for BOM (Next.js / TypeScript)

Install the plugin:

```bash
npm install --save-dev eslint-plugin-boundaries
```

Add to `eslint.config.mjs`:

```js
import { dirname } from "path"
import { fileURLToPath } from "url"
import { FlatCompat } from "@eslint/eslintrc"
import boundaries from "eslint-plugin-boundaries"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const compat = new FlatCompat({ baseDirectory: __dirname })

const COMPONENTS = [
  { name: 'api',              pattern: 'src/app/api/**' },
  { name: 'app-pages',        pattern: 'src/app/(dashboard)/**' },
  { name: 'app-auth',         pattern: 'src/app/(auth)/**' },
  { name: 'components',       pattern: 'src/components/**' },
  { name: 'lib',              pattern: 'src/lib/**' },
  { name: 'lib-permissions',  pattern: 'src/lib/permissions.ts', mode: 'file' },
  { name: 'db-schema-rbac',   pattern: 'src/db/schema/rbac.ts',  mode: 'file' },
  { name: 'db-schema-app',    pattern: 'src/db/schema/app.ts',   mode: 'file' },
  { name: 'db-schema-iam',    pattern: 'src/db/schema/iam.ts',   mode: 'file' },
  { name: 'db-schema-auth',   pattern: 'src/db/schema/auth.ts',  mode: 'file' },
  { name: 'db',               pattern: 'src/db/**' },
  { name: 'types',            pattern: 'src/types/**' },
  { name: 'hooks',            pattern: 'src/hooks/**' },
  { name: 'store',            pattern: 'src/store/**' },
]

const FORBIDDEN = [
  // rbac schema only via permissions.ts
  { from: ['api', 'components', 'app-pages'],
    to: 'db-schema-rbac',
    except: ['lib-permissions'],
    why: 'Directe queries op rbac.* buiten src/lib/permissions.ts zijn niet toegestaan.' },

  // Components don't touch DB directly
  { from: 'components',
    to: ['db-schema-app', 'db-schema-iam', 'db-schema-auth', 'db'],
    why: 'Components mogen niet direct de database importeren; gebruik API routes.' },

  // Store/hooks don't touch DB either
  { from: ['store', 'hooks'],
    to: ['db', 'db-schema-app', 'db-schema-iam', 'db-schema-rbac', 'db-schema-auth'],
    why: 'Store/hooks mogen niet direct de database importeren.' },
]

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: { 'boundaries/elements': COMPONENTS },
    rules: {
      'boundaries/dependencies': ['warn', { default: 'allow', rules: FORBIDDEN.map(e => ({
        from: e.from,
        disallow: e.to,
        message: e.why,
      })) }],
    },
  },
]
```

## 6. Pre-merge audit

- [ ] `npx eslint src/` — zero new warnings compared to baseline.
- [ ] No `rbac` schema imported outside `src/lib/permissions.ts`.
- [ ] No DB schema imported from `src/components/`.
