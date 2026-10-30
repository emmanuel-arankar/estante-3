## 2026-10-30 - O(1) Hash Map Lookups for Static Metadata
**Learning:** Helper functions operating on static JSON collections (e.g. language codes, IBGE location data, contributor roles, alternate name types, and script codes) were performing repeated linear $O(n)$ array searches (`.find()`, `.some()`) on every render pass in list components like `EditionsCarousel`, `PersonPage`, `BookPage`, and `EditionsPage`.
**Action:** Pre-build static module-scoped `Map` lookup tables when initializing static metadata modules to turn $O(n)$ array scans into $O(1)$ key lookups across all metadata lookups.
