# Monorepo Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the full VivahOS Infinity monorepo with correct configs, tsconfigs, and package.json for every workspace — no feature code.

**Architecture:** pnpm workspaces + Turborepo orchestration. Shared packages (`@vivah/types`, `@vivah/schemas`, `@vivah/db`) are built first so apps can declare workspace dependencies on them. Each app/package gets its own `tsconfig.json` extending `tsconfig.base.json` at root with app-specific overrides.

**Tech Stack:** Next.js 15, Express 4, FastAPI, Drizzle ORM, Tailwind v4, shadcn/ui, Vitest, Zod, TypeScript 5.7 strict

---

## File Map

### New files (28 total)

```
packages/types/
  package.json              @vivah/types — empty shared type package
  tsconfig.json             extends base, NodeNext, compiles to dist/
  src/index.ts              export {}

packages/schemas/
  package.json              @vivah/schemas — Zod schemas, depends on zod
  tsconfig.json             extends base, NodeNext, compiles to dist/
  src/index.ts              export {}

packages/db/
  package.json              @vivah/db — Drizzle ORM schema + migrations
  tsconfig.json             extends base, NodeNext, compiles to dist/
  drizzle.config.ts         points dialect=postgresql, schema=./schema/index.ts
  index.ts                  re-exports schema/index.ts

apps/api/
  package.json              @vivah/api — Express + Drizzle + BullMQ
  tsconfig.json             extends base, NodeNext, outDir=dist/
  vitest.config.ts          environment=node
  src/index.ts              minimal Express server, /health endpoint

apps/web/
  package.json              @vivah/web — Next.js 15 + Tailwind v4 + shadcn
  tsconfig.json             extends base, overrides module=ESNext, moduleResolution=bundler
  next.config.ts            transpilePackages for vivah/* workspaces
  postcss.config.mjs        @tailwindcss/postcss plugin
  components.json           shadcn/ui new-york style, Tailwind v4 config
  vitest.config.ts          environment=jsdom, @vitejs/plugin-react
  src/app/globals.css       @import "tailwindcss"
  src/app/layout.tsx        RootLayout, Metadata export
  src/app/page.tsx          minimal HomePage server component
  src/lib/utils.ts          cn() helper (clsx + tailwind-merge)

apps/ai-service/
  pyproject.toml            Python 3.11, FastAPI, uvicorn, scikit-learn, torch
  src/__init__.py           empty
  src/main.py               FastAPI app, /health route
  src/routers/__init__.py   empty
```

### Existing files (do not modify)
```
tsconfig.base.json          root strict tsconfig — extended by all workspaces
package.json                root scripts + turbo dev/build/test/lint/type-check
turbo.json                  task graph
pnpm-workspace.yaml         apps/* + packages/*
packages/db/schema/index.ts complete Phase 1 Drizzle schema — already written
```

### Known discrepancy (do not fix in this plan)
Root `package.json` db scripts use `--filter=@vivah/api`. They should be
`--filter=@vivah/db`. Leave root unchanged for now; add the db:* scripts to
`packages/db/package.json` so they work when called directly.

---

## Task 1: packages/types

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/index.ts`

- [ ] **Step 1: Create `packages/types/package.json`**

```json
{
  "name": "@vivah/types",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/src/index.js",
  "types": "./dist/src/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/src/index.d.ts",
      "default": "./dist/src/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "type-check": "tsc --noEmit",
    "lint": "eslint src"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create `packages/types/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `packages/types/src/index.ts`**

```typescript
export {};
```

- [ ] **Step 4: Commit**

```bash
git add packages/types
git commit -m "chore: scaffold @vivah/types package"
```

---

## Task 2: packages/schemas

**Files:**
- Create: `packages/schemas/package.json`
- Create: `packages/schemas/tsconfig.json`
- Create: `packages/schemas/src/index.ts`

- [ ] **Step 1: Create `packages/schemas/package.json`**

```json
{
  "name": "@vivah/schemas",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/src/index.js",
  "types": "./dist/src/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/src/index.d.ts",
      "default": "./dist/src/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "type-check": "tsc --noEmit",
    "lint": "eslint src"
  },
  "dependencies": {
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create `packages/schemas/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `packages/schemas/src/index.ts`**

```typescript
export {};
```

- [ ] **Step 4: Commit**

```bash
git add packages/schemas
git commit -m "chore: scaffold @vivah/schemas package"
```

---

## Task 3: packages/db

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/index.ts`

- [ ] **Step 1: Create `packages/db/package.json`**

```json
{
  "name": "@vivah/db",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "type-check": "tsc --noEmit",
    "lint": "eslint schema",
    "db:push": "drizzle-kit push",
    "db:generate": "drizzle-kit generate",
    "db:seed": "tsx seed/index.ts",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "drizzle-orm": "^0.38.0",
    "pg": "^8.13.0"
  },
  "devDependencies": {
    "@types/pg": "^8.11.0",
    "@types/node": "^20.0.0",
    "drizzle-kit": "^0.29.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["index.ts", "schema/**/*.ts"],
  "exclude": ["node_modules", "dist", "migrations", "seed"]
}
```

- [ ] **Step 3: Create `packages/db/drizzle.config.ts`**

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? '',
  },
});
```

- [ ] **Step 4: Create `packages/db/index.ts`**

```typescript
export * from './schema/index.js';
```

- [ ] **Step 5: Commit**

```bash
git add packages/db
git commit -m "chore: scaffold @vivah/db package with drizzle config"
```

---

## Task 4: apps/api

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/src/index.ts`

- [ ] **Step 1: Create `apps/api/package.json`**

```json
{
  "name": "@vivah/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/src/index.js",
    "lint": "eslint src",
    "type-check": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "express": "^4.21.0",
    "drizzle-orm": "^0.38.0",
    "pg": "^8.13.0",
    "ioredis": "^5.4.0",
    "bullmq": "^5.0.0",
    "@vivah/types": "workspace:*",
    "@vivah/schemas": "workspace:*",
    "@vivah/db": "workspace:*"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/pg": "^8.11.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.7.0",
    "tsx": "^4.19.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `apps/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `apps/api/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
});
```

- [ ] **Step 4: Create `apps/api/src/index.ts`**

```typescript
import express, { type Request, type Response } from 'express';

const app = express();
const PORT = parseInt(process.env['PORT'] ?? '4000', 10);

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok' }, error: null, meta: null });
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
```

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "chore: scaffold @vivah/api (Express + TypeScript)"
```

---

## Task 5: apps/web

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/components.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/lib/utils.ts`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@vivah/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "15.1.8",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.6.0",
    "class-variance-authority": "^0.7.0",
    "lucide-react": "^0.460.0",
    "@vivah/types": "workspace:*",
    "@vivah/schemas": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.7.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "15.1.8",
    "vitest": "^2.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0"
  }
}
```

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "allowJs": true,
    "incremental": true,
    "exactOptionalPropertyTypes": false,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `apps/web/next.config.ts`**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@vivah/types', '@vivah/schemas', '@vivah/db'],
};

export default nextConfig;
```

- [ ] **Step 4: Create `apps/web/postcss.config.mjs`**

```javascript
/** @type {import('postcss').ProcessOptions} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
```

- [ ] **Step 5: Create `apps/web/components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 6: Create `apps/web/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 7: Create `apps/web/src/app/globals.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 8: Create `apps/web/src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'VivahOS Infinity',
  description: 'National Smart Marriage-Centric Event Ecosystem',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Create `apps/web/src/app/page.tsx`**

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-4xl font-bold text-[#0A1F4D]">VivahOS Infinity</h1>
    </main>
  );
}
```

- [ ] **Step 10: Create `apps/web/src/lib/utils.ts`**

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 11: Commit**

```bash
git add apps/web
git commit -m "chore: scaffold @vivah/web (Next.js 15 + Tailwind v4 + shadcn)"
```

---

## Task 6: apps/ai-service

**Files:**
- Create: `apps/ai-service/pyproject.toml`
- Create: `apps/ai-service/src/__init__.py`
- Create: `apps/ai-service/src/main.py`
- Create: `apps/ai-service/src/routers/__init__.py`

- [ ] **Step 1: Create `apps/ai-service/pyproject.toml`**

```toml
[project]
name = "vivah-ai-service"
version = "0.1.0"
description = "VivahOS AI Service — ML scoring, matchmaking, fraud detection"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "pydantic>=2.9.0",
    "scikit-learn>=1.5.0",
    "torch>=2.5.0",
    "transformers>=4.46.0",
    "python-dotenv>=1.0.0",
    "httpx>=0.27.0",
    "anthropic>=0.37.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.24.0",
    "ruff>=0.7.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
target-version = "py311"
line-length = 100
select = ["E", "F", "I", "N", "W"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 2: Create `apps/ai-service/src/__init__.py`**

```python
```

(empty file)

- [ ] **Step 3: Create `apps/ai-service/src/main.py`**

```python
from fastapi import FastAPI

app = FastAPI(
    title="VivahOS AI Service",
    version="0.1.0",
    description="ML scoring, AI matchmaking, fraud detection",
)


@app.get("/health")
def health() -> dict[str, object]:
    return {"success": True, "data": {"status": "ok"}, "error": None, "meta": None}
```

- [ ] **Step 4: Create `apps/ai-service/src/routers/__init__.py`**

```python
```

(empty file)

- [ ] **Step 5: Commit**

```bash
git add apps/ai-service
git commit -m "chore: scaffold vivah-ai-service (FastAPI + pyproject.toml)"
```

---

## Task 7: Verify install & type-check

- [ ] **Step 1: Install all dependencies**

```bash
pnpm install
```

Expected: Resolves workspace dependencies across all 6 packages/apps. No errors.

- [ ] **Step 2: Type-check all TypeScript workspaces**

```bash
pnpm type-check
```

Expected: All 5 TS workspaces pass with zero errors.

- [ ] **Step 3: Commit final state**

```bash
git add -A
git commit -m "chore: monorepo scaffold complete — all workspaces configured"
```

---

## Self-Review Checklist

- [x] All 6 workspaces have `package.json` — ✅
- [x] All 5 TS workspaces have `tsconfig.json` extending base — ✅
- [x] apps/web overrides `module`/`moduleResolution` for Next.js bundler — ✅
- [x] Tailwind v4 uses CSS-first config, no `tailwind.config.ts` — ✅
- [x] shadcn `components.json` has empty `tailwind.config` for v4 compat — ✅
- [x] `packages/db/index.ts` uses `.js` extension in re-export (NodeNext requirement) — ✅
- [x] `drizzle.config.ts` references existing `./schema/index.ts` — ✅
- [x] Root db filter discrepancy noted, not silently fixed — ✅
- [x] No feature code anywhere — only configs, empty index files, minimal entry points — ✅
- [x] Design system colors used in `page.tsx` (`text-[#0A1F4D]`) — ✅
- [x] Server Components by default (no `'use client'` in layout/page) — ✅
- [x] API response envelope `{ success, data, error, meta }` in `/health` — ✅
