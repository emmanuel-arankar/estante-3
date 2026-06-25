## 2025-05-15 - [Hero Component Re-render Bottleneck]
**Learning:** The `Hero` component background particles used `Math.random()` in the render loop for position and animation properties. Since `searchQuery` state was at the top level of `Hero`, every keystroke in the search bar caused all 20 animated nodes to re-calculate random properties, leading to visual jitter and high CPU usage during typing.
**Action:** Isolate high-frequency state (like search inputs) into leaf components. Use `useMemo` to stabilize random visual properties that should only be generated once.

## 2025-05-15 - [Global Response Wrapping Anti-pattern]
**Learning:** The `backend-api` uses a global `responseWrapper` middleware that automatically nests any returned JSON under a `data` key. Developers returning `{ data: { ... } }` from routes cause double-nesting `{ data: { data: { ... } } }`, which often breaks frontend expectations or tests checking for specific property paths.
**Action:** Check for response-modifying middleware before defining route return structures. In this repo, route handlers should return the payload directly.
