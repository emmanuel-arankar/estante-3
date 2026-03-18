
## 2026-03-18 - [Vite SSR & Firebase Test Stability]
**Learning:** Object-based manualChunks in vite.config.ts can include externalized modules (like 'react') during SSR builds, causing "cannot be included in manualChunks" errors. Additionally, Firebase Admin requires explicit projectId and databaseURL in test environments even when using ADC.
**Action:** Use function-based manualChunks in Vite and provide explicit config to Firebase Admin in non-managed environments.
