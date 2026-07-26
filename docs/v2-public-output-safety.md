# V2 Public-Output Safety and Eligibility Foundation

## Eligibility pipeline
1. Validate record shape.
2. Require `recordGovernance.recordStatus === approved`.
3. Require `recordGovernance.publicEligibility === true`.
4. Require valid scope (`standard_size`, `family`, `chemistry_specific_family`, `exact_model`, `platform`, `application_family`, `specialist_only_pathway`).
5. Evaluate category critical fields from `battery-record-schema.json` category profiles.
6. Block on critical missing/provenance/rights/conflict issues.

Compatibility eligibility remains separate and is not inferred.

## Field filtering
Each field is evaluated for value presence, required unit, source IDs, verified evidence, authority requirement, scope, rights, and conflict status.
Returned statuses:
- `public`
- `withheld_unverified`
- `withheld_rights`
- `withheld_conflict`
- `withheld_scope_unknown`
- `withheld_malformed`

Non-critical withheld fields do not automatically block record-level eligibility.

## Rights filtering
Supported public-display rights values:
- `cleared`
- `restricted`
- `unknown`
- `not_applicable`

`restricted` and `unknown` withhold fields. Record-level blocking occurs only when a critical field is withheld for rights.

## Conflict handling
- Critical unresolved conflicts block verified public output.
- Non-critical unresolved conflicts withhold only that field.
- Public conflict wording: “Some information is withheld while conflicting evidence is reviewed.”

## Scope handling
Scope labels are mapped from internal scope values in `data/public-output-rules.json`.
Every result includes:
“This record identifies a battery scope. It does not by itself confirm compatibility with a particular device or vehicle.”

## Relationship publication filtering
Allowed public relationship types in this sprint:
- `manufacturer_alias`
- `same_standard_family`
- `incompatible`

Suppressed in this sprint:
- `verified_direct_equivalent`
- `conditional_substitute`
- `similar_specification`
- `insufficient_evidence`

## Unknowns and limitations
Public output keeps distinct arrays:
- `criticalUnknowns`
- `withheldFields`
- `conflicts`
- `limitations`

`criticalUnknowns` are present before `nextAction` in output order.

## Fallback states
Fallback definitions live in `data/public-fallback-states.json` for:
- approved_public_record
- record_under_review
- record_rights_restricted
- record_incomplete
- record_disputed
- unknown_code
- technical_failure
- multiple_possible_records
- record_deprecated
- record_retired
- malformed_record

Fallback messages never expose stack traces, raw JSON, or internal notes.

## Separation from compatibility
Sanitised output always sets:
- `compatibilityStatus: "not_assessed"`
- `notAssessed: ["Device-specific compatibility has not been assessed."]`

No compatibility inference is added from identity, dimensions, chemistry, aliases, or relationships.
