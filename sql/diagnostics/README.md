# Read-Only Database Diagnostics

- `preflight_v2_production_release.sql` checks the live V1 schema and data
  assumptions required by the ordered V2 migrations. Run it before any V2
  production write.
- `verify_v2_production_release.sql` verifies the required V2 tables, columns,
  functions, RLS state, and catalog corrections after the approved migrations
  finish and before the V2 frontend deploys.
- `verify_staging_baseline.sql` checks the verified schema, RLS, grants,
  Storage, and required seed counts.
- `export_production_exercise_templates.sql` exports non-member exercise
  configuration for audit comparison.
- `compare_exercise_seed.rb` compares that CSV export with the archived starter
  exercise seed.

Example comparison from the repository root:

```bash
ruby sql/diagnostics/compare_exercise_seed.rb path/to/export.csv \
  sql/archive/applied/exercise_library_seed_rip_city_v1.sql
```

Always confirm the dashboard project reference before running SQL. Diagnostics
must remain read-only unless they are deliberately promoted into a reviewed
timestamped migration.
