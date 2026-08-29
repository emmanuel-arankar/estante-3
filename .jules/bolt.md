## 2026-08-29 - Memoization of Comment Tree and Sub-components
**Learning:** In comment-heavy components like `ReviewComments.tsx`, unmemoized tree construction (`buildCommentTree` and `sortRoots`) and sub-components (`CommentItem`, `CommentLikesButton`) cause massive cascade re-renders across the entire comment list on every keystroke when typing into comment/reply input fields.
**Action:** Always wrap tree derivation logic in `useMemo` and sub-components in `React.memo` with explicit `displayName`s to ensure input state updates only re-render the input component itself.
