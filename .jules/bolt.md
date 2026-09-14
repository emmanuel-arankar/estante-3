## 2026-09-14 - Isolating Resource Lifecycles from Timer State
**Learning:** Including ticking state (like `duration`) in `useEffect` dependency arrays that manage native streams or hardware API objects (such as `MediaRecorder` or `AudioContext`) causes continuous teardown, re-creation, and event-triggering on every interval tick.
**Action:** Isolate timer intervals into dedicated `useEffect`s and store volatile values in refs so native stream setup effects depend strictly on the stream instance.
