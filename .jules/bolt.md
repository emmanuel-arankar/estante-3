## 2025-05-15 - [Refactoring components with React.memo]
**Learning:** When applying `memo()` to large components via `replace_with_git_merge_diff`, overlapping SEARCH/REPLACE blocks can easily introduce parsing errors (like mismatched parentheses or extra semicolons) that break the build.
**Action:** Always run `npm run dev` or a build command after refactoring high-frequency UI components to ensure syntax integrity before submission.
