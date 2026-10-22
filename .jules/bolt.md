## 2026-10-22 - Stabilizing custom hook callbacks with `useRef`
**Learning:** Adding function parameters (like `fetchFn`) directly to `useEffect` dependency arrays when custom hooks are called with inline arrow functions causes infinite re-render loops or unnecessary effect re-executions.
**Action:** Store dynamic callback functions in a `useRef` (`fetchFnRef.current = fetchFn`) updated on every render, allowing `useEffect` to rely strictly on stable primitives (`userId1`, `userId2`) while invoking the latest function reference.
