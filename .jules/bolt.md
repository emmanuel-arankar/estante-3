## 2026-04-29 - [Visual Jitter and Redundant Re-renders in Hero]
**Learning:** Animated background elements using `Math.random()` directly in the render loop cause visual "jumping" and $O(N)$ performance overhead on every parent state update (e.g., search input keystrokes).
**Action:** Extract animated elements into a separate `React.memo` component and stabilize random values with `useMemo` to ensure they are only calculated once on mount.

## 2026-04-29 - [Package-lock.json Peer Dependency Metadata Loss]
**Learning:** Running `npm install` in this environment can strip `"peer": true` metadata from `package-lock.json` across thousands of entries, creating massive and unrelated diffs.
**Action:** Always verify `package-lock.json` after installation and revert if metadata loss occurs, keeping PRs focused on performance changes.
