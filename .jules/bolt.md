# Bolt's Journal - Critical Performance Learnings

## 2026-11-01 - Barrel Re-Exports Breaking Dynamic Import Code-Splitting in Vite
**Learning:** Re-exporting a dynamically imported route or component inside a shared barrel file (e.g. `export * from './curatorship/curatorship.routes'` in `src/features/routes.ts`) creates a static import graph dependency whenever the barrel file is imported elsewhere. When Vite detects a module being both dynamically imported (`lazy: () => import(...)`) and statically reachable via barrel re-exports, it cannot split the module into an isolated chunk and forces it into the main entry bundle (`index-*.js`), degrading initial load performance for all users.
**Action:** Always omit lazy/dynamically loaded route definitions and heavy modals from top-level feature barrel files (`routes.ts` or `index.ts`), or import directly from specific submodules rather than broad barrel files.
