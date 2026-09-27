# Frontend Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a runnable React, Vite, and TypeScript frontend with the project's agreed page-centered directory structure.

**Architecture:** The Vite application remains at `frontend/`. Shared UI lives in `src/components`, page-only UI lives under `src/pages/<PageName>/components`, and MapLibre-specific shared components live in `src/components/map`. Empty-but-intentional source directories receive `.gitkeep` files so Git and coding agents retain the agreed structure.

**Tech Stack:** React, Vite, TypeScript, ESLint, MapLibre GL JS.

**Spec:** Conversation design agreement: one monorepo, page-centered frontend structure, MapLibre-ready common components, and documented AI conventions.

## Global Constraints

- Use React + Vite + TypeScript.
- Do not add application features or page UI beyond Vite's minimal runnable shell.
- Keep every secret out of Git; commit only `.env.example`.
- Put MapLibre shared code only under `frontend/src/components/map`.
- Work in the user-selected checkout at `C:\Users\lee02\Desktop\Project\All4land-6`.

---

### Task 1: Create the Vite frontend baseline

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/vite.config.ts`

**Interfaces:**
- Produces: a Vite app runnable with `npm run dev` and buildable with `npm run build`.

- [x] **Step 1: Generate the React TypeScript Vite project**

Run: `npm create vite@latest frontend -- --template react-ts`

- [x] **Step 2: Install project dependencies**

Run: `npm install --prefix frontend`

- [x] **Step 3: Verify the baseline build**

Run: `npm run build --prefix frontend`
Expected: Vite completes successfully and writes `frontend/dist`.

- [ ] **Step 4: Commit the baseline**

Run: `git add frontend && git commit -m "chore: 프론트엔드 Vite 초기화"`

### Task 2: Add the agreed directory skeleton and environment sample

**Files:**
- Create: `frontend/src/api/.gitkeep`
- Create: `frontend/src/assets/images/.gitkeep`
- Create: `frontend/src/assets/fonts/.gitkeep`
- Create: `frontend/src/assets/css/.gitkeep`
- Create: `frontend/src/components/common/.gitkeep`
- Create: `frontend/src/components/layout/.gitkeep`
- Create: `frontend/src/components/map/.gitkeep`
- Create: `frontend/src/constants/.gitkeep`
- Create: `frontend/src/hooks/.gitkeep`
- Create: `frontend/src/pages/ExamplePage/components/.gitkeep`
- Create: `frontend/src/routes/.gitkeep`
- Create: `frontend/src/store/.gitkeep`
- Create: `frontend/src/types/.gitkeep`
- Create: `frontend/src/utils/.gitkeep`
- Create: `frontend/.env.example`

**Interfaces:**
- Consumes: the Vite frontend from Task 1.
- Produces: stable paths for shared UI, page-local UI, API clients, state, and utilities.

- [x] **Step 1: Create the agreed directories**

Create each directory listed above, retaining it using an empty `.gitkeep` file.

- [x] **Step 2: Add the environment-variable sample**

Write `VITE_API_BASE_URL=http://localhost:8080` to `frontend/.env.example`.

- [x] **Step 3: Verify the structure**

Run: `Get-ChildItem -Recurse frontend/src | Select-Object FullName`
Expected: every path listed above exists.

- [ ] **Step 4: Commit the structure**

Run: `git add frontend && git commit -m "chore: 프론트엔드 기본 폴더 구조 추가"`

### Task 3: Document code-placement rules for contributors and agents

**Files:**
- Create: `frontend/README.md`
- Create: `AGENTS.md`

**Interfaces:**
- Consumes: the directory layout from Task 2.
- Produces: unambiguous rules for people and coding agents to place files consistently.

- [x] **Step 1: Document frontend setup and directory ownership**

In `frontend/README.md`, document `npm install`, `npm run dev`, `npm run build`, and the agreed directory rules: page-only UI goes in `pages/<PageName>/components`; reusable UI goes in `components`; MapLibre shared code goes in `components/map`.

- [x] **Step 2: Add the compact agent instruction file**

In `AGENTS.md`, state the frontend directory placement rules and require `.env.example` instead of committing `.env` files.

- [ ] **Step 3: Re-run the production build**

Run: `npm run build --prefix frontend`
Expected: exit code 0.

- [ ] **Step 4: Commit the documentation**

Run: `git add frontend/README.md AGENTS.md && git commit -m "docs: 프론트엔드 구조 규칙 추가"`
