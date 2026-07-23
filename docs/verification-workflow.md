# NewBatteries Verification Workflow

This document describes the pipeline a battery record or relationship record must pass through before it can be published as an approved record on the NewBatteries platform.

---

## Pipeline Stages

```
Draft
  → Evidence collected
    → Technical review
      → Conflict review
        → Approved
          → Published
            → Periodically reverified
              → Retired
```

### Draft
A new record is created, typically from user-supplied information, AI-assisted drafting, or an initial data import. The record is marked `reviewStatus: "draft"` and `confidence: "low"`. Draft records must not appear as verified in any public-facing interface. All unknown or unconfirmed fields must be listed in the `unknowns` array.

### Evidence Collected
A reviewer or data maintainer locates and records supporting evidence from appropriate sources (see evidence hierarchy in evidence-governance.md). Each piece of evidence is linked to the record via `sourceIds`. At this stage, the record may remain `draft` until evidence is sufficient.

### Technical Review
A qualified reviewer checks:
- All required fields are present and accurate
- Technical specifications are consistent with the evidence sources cited
- The `confidence` level accurately reflects the evidence quality
- No unsupported claims appear in compatibility fields
- Warnings and unknowns are complete and accurate

If technical review passes, the record status may be updated to `reviewStatus: "reviewed"`.

### Conflict Review
The reviewer confirms:
- No conflicting evidence exists across sources
- Where conflicts were found, they are documented in `unknowns` and either resolved or escalated
- Commercial relationships have not influenced the classification

### Approved
If all stages pass, the record is updated to `reviewStatus: "approved"`. Only approved records may generate verified public-facing results.

### Published
The approved record is deployed as part of the live dataset. The `lastVerified` date is set to the approval date.

### Periodically Reverified
Approved records must be reverified periodically (at minimum annually, or when a relevant manufacturer publishes updated specifications). If reverification reveals a change, the record is returned to `draft` or `reviewed` status until the update is confirmed.

### Retired
Records for discontinued or superseded batteries are marked `reviewStatus: "retired"`. Retired records must not appear in live compatibility results.

---

## Required Fields for Approved Records

Every record with `reviewStatus: "approved"` must include the following fields, fully populated:

| Field | Description |
|---|---|
| `batteryId` | Unique record identifier |
| `category` | Battery category (from approved enum) |
| `canonicalCode` | Primary standardised battery code |
| Technical attributes | Voltage, dimensions, chemistry, rechargeable status |
| `sourceIds` | At least one verified source reference |
| Evidence source | Source URL or reference traceable to a primary document |
| Source claim | The specific claim from the source that supports this record |
| `lastVerified` | ISO 8601 date of most recent verification |
| `confidence` | Evidence confidence level (`low`|`medium`|`high`) |
| `unknowns` | All unconfirmed attributes listed (empty array if none) |
| `warnings` | All relevant safety or usage warnings |
| `reviewStatus` | Must be `"approved"` |

---

## Roles

- **Data contributor**: Drafts records and locates initial evidence.
- **Technical reviewer**: Validates technical accuracy, checks evidence, resolves conflicts.
- **Approver**: Confirms the record meets all requirements and updates status to `approved`.

No single person should both draft and approve the same record without independent review.

---

## Evidence Governance Reference

See `docs/evidence-governance.md` for the evidence hierarchy and governance rules that apply at every stage of this workflow.
