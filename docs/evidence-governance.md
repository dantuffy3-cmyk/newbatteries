# NewBatteries Evidence Governance

This document sets out the rules and evidence hierarchy that govern all compatibility claims, battery records, and relationship records on the NewBatteries platform.

---

## Evidence Rules

**Rule 1 — AI output alone is never compatibility evidence.**
AI-generated text, code, or summaries may be used to draft records for human review, but must never be published as a verified compatibility claim or used as the sole basis for any classification.

**Rule 2 — Manufacturer technical documents outrank retailer descriptions.**
Where a conflict exists between a manufacturer's technical datasheet and a retailer's product description, the manufacturer's technical document takes precedence. Retailer descriptions may be influenced by commercial incentives and are not authoritative.

**Rule 3 — Government and regulator sources are authoritative for safety and recall information.**
Government agencies and statutory bodies are the authoritative source for safety classifications, compliance requirements, and product recall information. Their determinations must not be restated in a way that changes their meaning.

**Rule 4 — Publicly viewable content does not automatically permit scraping or republication.**
The fact that content is accessible online does not confer permission to reproduce, aggregate, or republish it. Licensing status must be assessed for each source before data is incorporated into NewBatteries records.

**Rule 5 — Supplier ranking and paid placement must never affect compatibility classification.**
Commercial relationships, supplier agreements, and paid placements must have no influence on how compatibility is assessed, displayed, or classified. Conflicts of interest must be disclosed and excluded from the assessment process.

**Rule 6 — Missing data is an unknown, not a match.**
If a specification, dimension, chemistry, or other attribute is absent from a record, it must be recorded in the `unknowns` field. It must never be treated as confirmation that the attribute matches another battery.

**Rule 7 — Conflicting evidence must be recorded and escalated.**
Where two or more sources provide conflicting technical information about the same attribute, the conflict must be recorded in the record's `unknowns` field and escalated for technical review before the record can be approved.

**Rule 8 — Draft data must not appear as verified.**
Records with `reviewStatus: "draft"` or `reviewStatus: "reviewed"` must not be presented to users as verified or approved. Only records with `reviewStatus: "approved"` may be displayed as verified.

**Rule 9 — Compatibility claims must identify evidence, confidence and verification requirements.**
Every compatibility classification must be accompanied by the evidence on which it is based, the confidence level, and the verification steps that must be completed before a user acts on the result.

**Rule 10 — "No recall found" is never proof that a product is safe.**
The absence of a recorded recall does not confirm that a battery is safe for a given application. Recall databases may be incomplete, outdated, or jurisdiction-specific. Safety must be assessed through positive evidence, not the absence of negative records.

---

## Evidence Hierarchy

The following hierarchy governs which sources take precedence when evidence conflicts. Higher numbers are lower authority.

1. **Official manufacturer technical documentation** — Datasheets, technical bulletins, and fitment guides published directly by the battery manufacturer.
2. **Government or regulator data** — Statutory compliance data, safety classifications, and recall notices from government agencies.
3. **Verified supplier or distributor technical catalogue** — Technical catalogue entries from a verified supplier or distributor, reviewed against manufacturer specifications.
4. **Recognised standards or stewardship body** — Specifications and designations from recognised standards bodies (e.g. IEC, ISO, SAE, JISC).
5. **NewBatteries independently verified record** — A record that has completed the full NewBatteries verification workflow and holds `reviewStatus: "approved"`.
6. **Reputable secondary technical source** — Independent technical publications, engineering references, or verified cross-reference databases, reviewed for accuracy.
7. **Community-maintained information** — Open databases or community-maintained cross-reference lists. Must be reviewed against primary sources before use.
8. **User-supplied information** — Information provided by individual users via the finder or enquiry flow. Unverified; for draft records only.
9. **AI inference alone** — AI-generated output without supporting primary evidence. For draft generation only; must never appear in approved records.

---

## Application

These rules apply to all battery records (`data/batteries.json`), relationship records (`data/relationships.json`), and any content displayed on the NewBatteries platform.

Any deviation from these rules must be documented, justified, and approved by a technical reviewer before a record can proceed to `approved` status.
