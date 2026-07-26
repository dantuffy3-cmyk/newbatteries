# First Three Governed Records Review

## CR2032
- **Why selected:** Clear standard-size coin cell with common substitution risk.
- **Record type:** `standard_size`
- **Verified fact:** Diameter 20.0 mm, thickness 3.2 mm, nominal voltage 3.0 V, lithium manganese dioxide chemistry, and non-rechargeable status are populated from the Maxell CR2032 datasheet (`SRC-MAXELL-CR2032-2026-001`).
- **Verified fact:** Safety context is limited to conservative ingestion and compartment-closure guidance from CPSC button/coin-cell safety material (`SRC-US-CPSC-BUTTON-BATTERY-2026-001`).
- **Unverified field:** Typical applications, weight, and recall review remain unset.
- **Inference:** Application class is used only as internal taxonomy and is not a sourced use-case claim.
- **Relationship risk:** CR2025 and CR2016 share diameter cues, but same diameter does not prove interchangeability; thickness/contact-pressure differences remain a blocking risk.
- **Licensing uncertainty:** Datasheet values were verified for internal governance only. Public reuse rights are still unknown.
- **Governance status:** `under_review`, `publicEligibility: false`, `compatibilityEngineEligibility: false`.
- **Approval blockers:** Manual evidence cross-check, rights review, and device-specific closure/interchangeability review.
- **Public-use recommendation:** Potentially suitable for public use only after evidence review and manual approval.
- **Next research action:** Add a second authoritative source or recognized-standard cross-check for the core fields.

## LR44
- **Why selected:** Standard-size button cell that exercises alias and chemistry governance.
- **Record type:** `standard_size`
- **Verified fact:** Diameter 11.6 mm, thickness 5.4 mm, nominal voltage 1.5 V, alkaline manganese dioxide chemistry, and non-rechargeable status are populated from the Murata LR44 datasheet (`SRC-MURATA-LR44-2026-001`).
- **Unverified field:** Typical applications and any direct-equivalent relationship remain unset.
- **Inference:** Application class is used only as internal taxonomy and is not a sourced use-case claim.
- **Alias risk:** `AG13` is treated only as a marketing/cross-reference candidate, not a governed alias or direct equivalent.
- **Relationship risk:** `SR44` stays a separate chemistry-specific record; this sprint does not approve LR44↔SR44 interchangeability.
- **Licensing uncertainty:** Datasheet values were verified for internal governance only. Public reuse rights are still unknown.
- **Governance status:** `under_review`, `publicEligibility: false`, `compatibilityEngineEligibility: false`.
- **Approval blockers:** Manual alias review, chemistry-specific relationship review, and rights review.
- **Public-use recommendation:** Potentially suitable for public use after alias governance and manual approval.
- **Next research action:** Gather authorized-catalogue evidence before promoting any alias or substitution guidance.

## LN2 Flooded Lead-Acid Family
- **Why selected:** Automotive size-family case that exercises family-scope, chemistry-scope, and fitment governance.
- **Record type:** `chemistry_specific_family`
- **Verified fact:** Family-level flooded LN2/L2 evidence supports 242 × 175 × 190 mm dimensions, 12 V nominal system voltage, flooded lead-acid chemistry, and B13 hold-down/base references from the Leoch DIN Series (MF) catalogue (`SRC-LEOCH-L2-FLOODED-2026-001`).
- **Unverified field:** Terminal layout, polarity orientation, capacity, CCA, reserve capacity, and vehicle fitment remain unset.
- **Inference:** Application class is internal taxonomy only and is not a fitment recommendation.
- **Relationship risk:** LN2 flooded is not automatically interchangeable with LN2 AGM or LN2 EFB; L2/H5/DIN marketing labels do not establish direct equivalence.
- **Relationship risk:** Vehicle-specific tray size, cable reach, hold-down, cover clearance, chemistry requirements for start-stop systems, and BMS registration still require manual confirmation.
- **Licensing uncertainty:** Catalogue values were verified for internal governance only. Public reuse rights are still unknown.
- **Governance status:** `under_review`, `publicEligibility: false`, `compatibilityEngineEligibility: false`.
- **Approval blockers:** Family-scope confirmation, terminal layout/polarity evidence, multi-source family evidence, and vehicle-fitment review.
- **Public-use recommendation:** Internal use only until family scope and evidence are manually approved.
- **Next research action:** Obtain at least one additional authoritative flooded LN2 family source and resolve whether layout/polarity can be governed at family level.
