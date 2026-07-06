## 2025-06-07 - Sequential Callback Stability in Lists
**Learning:** Using `useCallback` with an array dependency (like `messages`) in a list parent causes all child items to re-render whenever the array changes.
**Action:** Use a `useRef` to store the latest array reference. Handlers can then access the latest state via `ref.current` without needing the array in their dependency list, keeping the callback reference stable and enabling effective `React.memo` on children.

## 2025-06-07 - Avoiding Build Artifact Pollution
**Learning:** Local `npm run dev` or `npm run build` commands can generate artifacts in `dev-dist/` or `dist/` that might not be in `.gitignore`.
**Action:** Always check `git status` before committing and use `git restore` to exclude generated files from the submission.

## 2025-06-07 - CI Infrastructure Alignment
**Learning:** Performance optimizations can be blocked by unrelated CI/test failures. In this case, Vitest required explicit Firebase initialization parameters (`projectId`, `databaseURL`) to run backend tests, and GitHub Actions workflows were using an outdated project ID.
**Action:** Ensure CI environment variables and initialization logic match the target project's requirements to keep the pipeline green.
