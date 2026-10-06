## 2026-10-06 - TipTap Editor Extension Array Memoization
**Learning:** Instantiating TipTap extension objects (StarterKit, Image, Mention, Paragraph, etc.) directly in the component render body causes new array and extension object references to be created on every render pass, triggering unnecessary TipTap editor configuration re-initializations and breaking React.memo child prop equality checks.
**Action:** Wrap TipTap extensions arrays in `useMemo` dependent on configuration props (`[variant, maxLength, placeholder]`), and wrap rich text editor components in `React.memo`.
