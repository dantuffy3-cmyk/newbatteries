# Source Authority Model

This model ranks evidence authority for battery data from Level 1 (highest) to Level 10 (lowest).

## Core rules

- Authority level is **not** the same as commercial reuse permission.
- Category profiles can change source priority requirements.
- AI inference alone must never create a verified technical fact.
- Conflicts remain unresolved until reviewed and recorded.
- Marketing copy is not automatically technical evidence.

## Authority hierarchy (1-10)

1. Manufacturer/OEM technical documentation
2. Government regulator / approved-product database / recognised standards body
3. Recognised technical standard or accredited certification source
4. Manufacturer-authorised distributor or official fitment guide
5. Reputable specialist distributor with traceable technical evidence
6. Supplier confirmation supported by documentation/measurements/photos
7. Clear user measurements/photos/equipment evidence
8. Retail listing
9. Community-maintained information
10. AI inference alone or unsupported assumption

## Category variation

Category profiles define preferred source types and stricter minimum evidence by category. For example, automotive families can require stronger authority combinations than household primary cells.

## Conflict handling

Where credible sources disagree, fields must keep explicit conflict objects (`unresolved`, `resolved`, `source_superseded`, `category_variant`). Records remain non-approved until conflict policy requirements are met.

## Field-level provenance

Technical fields use a provenance envelope containing value, unit, evidence confidence, source references, verification metadata, and optional conflict details.
