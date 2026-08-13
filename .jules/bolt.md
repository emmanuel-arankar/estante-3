# Bolt's Journal - Critical Learnings

## 2026-08-13 - [Notifications Reference Stability & React Hook Best Practices]
**Learning:**
1. Mapped or sliced arrays (like `flatMap` or `slice`) returned from React hooks or inline JSX create new array references on every render. This completely breaks reference stability and triggers unnecessary re-renders of memoized list items downstream.
2. Under the React Rules of Hooks, `useMemo` and other hook calls must reside at the top level of the component function, never inside conditionals, loops, or inline functions (e.g. IIFEs in JSX).
3. Local lexical declarations inside switch-case statements must be enclosed in block-scoped braces `{}` to satisfy ESLint's `no-case-declarations` and prevent variable bleeding across cases.

**Action:**
1. Always wrap any hook-derived arrays/objects (especially from `.flatMap` or `.map`) in `useMemo` within the hook itself.
2. In JSX, instead of doing `.slice()` inline, memoize the sliced array at the top level of the component function using `useMemo`.
3. Wrap case blocks containing lexical declarations (`const`, `let`) in curly braces `{}`.
