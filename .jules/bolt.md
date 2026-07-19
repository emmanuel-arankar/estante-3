## 2026-07-19 - Notification Performance Optimization
**Learning:** React query lists that are polled periodically (e.g. notifications) can trigger high-frequency re-renders. Derived data flat-maps create brand new array references on every execution.
**Action:** Wrap any flat-mapped list arrays from infinite queries in `useMemo` at the hook level, slice operations in parent components in `useMemo`, and list item components in `React.memo` with a stable `displayName` to maximize rendering efficiency.
