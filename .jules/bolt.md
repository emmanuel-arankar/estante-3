# Bolt's Journal

Critical learnings only.

## 2026-11-03 - Vite Code-Splitting vs Re-export Barrier
**Learning:** Re-exporting a dynamically imported route (`lazy: () => import(...)`) through an index or barrel file (`src/features/routes.ts`) causes Vite/Rollup to statically bundle the module into the main bundle or parent chunk, disabling lazy code-splitting and increasing initial bundle size.
**Action:** When a route is loaded via dynamic `import()` in the router configuration, avoid re-exporting it from shared barrel files (`features/routes.ts`) so Rollup can cleanly isolate it into its own async chunk.
