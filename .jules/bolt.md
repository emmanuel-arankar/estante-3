## 2026-04-12 - [CI/CD Fixes & Model Refinement]

**Learning:** CI failures revealed critical environmental dependencies and type safety gaps in the backend. 1. Firebase Admin initialization required an explicit `databaseURL` construction to support ADC in CI environments. 2. Backend tests mocking `auth.middleware` must include all used exports like `checkAuthOptional`. 3. Linting rules in the backend are stricter regarding `any` and unused variables compared to the frontend. 4. The `sanitize` utility consolidates whitespaces, which must be reflected in test assertions.

**Action:**
- Standardized Firebase initialization with project ID-based URL fallbacks.
- Refined `ChatMessage` and `User` models to replace `any` with specific types like `Date` and `Record<string, unknown>`.
- Aligned GitHub Action workflows with the primary project ID (`estante-75463`).
- Updated `sanitize.test.ts` to align with normalization logic and rich text preservation rules.
- Cleaned up unused Express middleware parameters to satisfy ESLint.
