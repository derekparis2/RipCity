# Seeds

Keep seed data separate from schema migrations whenever practical.

- Required configuration must be deterministic and safe to recreate.
- Staging/test seeds must be unmistakably fake.
- Never copy real members, Auth identities, workout logs, notes, or other
  production activity into staging.
- Mutable facility content belongs in production backups unless it is
  intentionally promoted into maintained default configuration.

The verified initial baseline currently includes the original required Rip City
configuration. New fake multi-facility scenarios will be added here later.
