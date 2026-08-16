# Database Tests

This directory is reserved for repeatable schema and RLS tests. Initial manual
verification remains in `sql/diagnostics/verify_staging_baseline.sql`.

Future tests should cover platform owner, facility admin, coach, athlete, H2K,
pending, inactive, and cross-facility access without depending on production
users or data.
