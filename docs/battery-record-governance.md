# Battery Record Governance

## Lifecycle

Record statuses: `draft` → `under_review` → `reviewed` → `approved` with alternate states `disputed`, `deprecated`, `retired`.

- `draft`: editable working state, never presented as verified.
- `under_review`: evidence being checked; cannot support definitive compatibility claims.
- `reviewed`: review completed but not yet approved.
- `approved`: evidence threshold met and governance fields complete.
- `disputed`: active conflict exposed to users/reviewers.
- `deprecated`: traceable historical record; not for new recommendations.
- `retired`: auditable historical record no longer active.

## Approval criteria

Approval requires all of the following:

1. Unambiguous identity.
2. Category-required fields complete or explicitly `not_applicable`.
3. Required technical values include traceable evidence and source IDs.
4. Source usage rights have been considered.
5. Conflicts are resolved or explicitly disclosed.
6. `recordStatus` is `approved`.
7. Version assigned.
8. Review date recorded.
9. No AI-inference-only technical values.

## Minimum evidence thresholds

- **Coin/button cells**: at least one Level 1-3 source for identity + dimensions/voltage.
- **Automotive families**: at least two independent sources with one from Level 1-4 and one from Level 2-5 for key fitment/electrical claims.
- **Power-tool platforms**: platform identity from Level 1-4 plus ecosystem/communication constraints evidence.
- **Household batteries**: standard family evidence from Level 1-4 and chemistry/voltage evidence.
- **Caravan/marine families**: installation and use constraints must include at least one Level 1-4 source and explicit risk notes.

## Disputes, deprecation, retirement

- Disputes must retain competing values and source references.
- Deprecated records remain visible for traceability but are excluded from new recommendations.
- Retired records remain auditable with change history retained.

## Versioning and audit

Each governed record stores `version`, `changeHistory`, and reviewer/date fields to preserve decision traceability.
