## 2026-06-18 - [Isolating High-Frequency State in Animated Components]
**Learning:** React components containing many animated nodes (like Framer Motion elements) or heavy background logic suffer significantly from O(N) re-renders when high-frequency state (like search input) is kept at the same level.
**Action:** Always isolate input states into standalone components to keep re-renders local and prevent 'jitter' or 'lag' in background animations during typing.
