# Evidence confidence model

Evidence confidence describes how trustworthy an input fact is. It does **not** describe whether a battery is compatible.

## Confidence levels

### High

Use for strong primary or verified evidence, such as:

- manufacturer technical documentation
- verified equipment specification
- recognised standards
- government or regulator sources
- clear supplier technical evidence
- reliable direct measurement

### Medium

Use for credible supporting evidence that still benefits from confirmation, such as:

- reputable distributor datasheets
- clear user measurements supported by photos
- standard-code inference supported by other evidence
- multiple credible secondary sources

### Low

Use for weak or approximate evidence, such as:

- partial labels
- approximate measurements
- image inference
- retail listings
- community-maintained information

### Unverified

Use when the source should not be trusted without stronger support, such as:

- AI inference alone
- user recollection
- unsupported assumptions
- unknown sources
- shape or colour guesses

## Confidence versus compatibility

A high-confidence field can still produce a blocked result if it confirms a physical conflict.

Likewise, a low-confidence field does not make a candidate compatible. It only means the field itself is not strongly supported.

## Field-level evidence

Evidence is recorded per field so the engine can show exactly what supports a result. Each evidence record includes:

- `evidenceId`
- `field`
- `value`
- `unit`
- `confidence`
- `sourceType`
- `sourceId`
- `capturedAt`
- `notes`

## Missing and conflicting evidence

Missing evidence must not be guessed.

- If a missing field is critical to a blocking rule, the layer should return `insufficient_evidence`.
- If a missing field affects only a non-critical conditional check, the layer can return `compatible_with_conditions`.

Conflicting evidence should be preserved for review. Stronger evidence can replace weaker evidence during re-evaluation, but the system should not silently override the earlier record.

## Review and re-evaluation

Physical-fit results should be re-evaluated when:

- a missing field becomes known
- a stronger evidence source corrects an earlier value
- a supplier provides reliable fitment proof
- the category profile or applied rule set changes

This approach keeps evidence confidence separate from the compatibility decision while still making trust visible.
