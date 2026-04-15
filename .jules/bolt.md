## 2026-04-15 - Chat Rendering Optimization
**Learning:** Chronologically sorted datasets like chat messages can be grouped in O(N) by only checking the tail of the accumulation array, avoiding costly `.find()` calls. Additionally, `React.memo` on list items only works if all passed callbacks are stabilized with `useCallback` and the props interface avoids anonymous functions.
**Action:** Always prefer single-pass grouping for sorted data and use stable callback signatures (passing IDs) for high-frequency list components.
