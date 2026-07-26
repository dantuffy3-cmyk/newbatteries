# V2 Public Result Language

## Approved wording
- Scope explanation: “This record identifies a battery scope. It does not by itself confirm compatibility with a particular device or vehicle.”
- Compatibility status wording: “Device-specific compatibility has not been assessed.”

## Fallback wording
- Under review: “A possible record exists, but it has not yet completed NewBatteries’ evidence review.”
- Unknown code: “We could not identify this code in the current governed records.”
- Technical failure: “The battery record could not be loaded. No compatibility conclusion has been made.”

## Relationship wording
- `manufacturer_alias` → “Manufacturer naming”
- `same_standard_family` → “Same standard family — this does not confirm compatibility”
- `incompatible` → “Known incompatibility”

Never use “equivalent” as generic public wording in this sprint.

## Prohibited claims
Do not output these terms as compatibility conclusions:
- compatible
- suitable
- recommended
- safe replacement
- direct substitute
- universal fit

## Scope labels
- `standard_size` → “Standard-size record”
- `family` → “Battery family record”
- `chemistry_specific_family` → “Chemistry-specific family record”
- `exact_model` → “Exact model record”
- `platform` → “Battery platform record”
- `application_family` → “Application-family record”
- `specialist_only_pathway` → “Specialist-only pathway”

## Safety language
Show safety flags only when provenance is verified, rights are cleared, and the flag is category-relevant. Safety text must not imply compatibility or certification.

## Next-action patterns
Use neutral next actions only:
- check back after review
- provide additional identifying details
- await rights/conflict resolution
- retry later for technical failures

Do not use recommendation language implying compatibility outcomes.
