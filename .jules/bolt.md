# Bolt's Journal - Critical Learnings

## 2026-10-24 - Initial setup
**Learning:** Monorepo test execution: `vitest` without `--dir src` runs root and backend tests that require backend configuration. Running `npx vitest run --dir src` safely isolates frontend tests.
**Action:** Always run `npx vitest run --dir src` for verifying frontend UI component optimizations.
