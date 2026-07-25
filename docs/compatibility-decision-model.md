# Compatibility decision model

NewBatteries uses a rules-first compatibility decision model for this prototype physical-fit layer.

## Rule taxonomy

The model supports three rule types:

- **blocking** — a confirmed conflict that stops the candidate from progressing
- **conditional** — a candidate may still fit, but one or more checks remain unresolved
- **informational** — useful context that should be shown without changing the core outcome on its own

Individual rule results use these statuses:

- `pass`
- `fail`
- `conditional`
- `unknown`
- `not_applicable`

Layer outcomes use these states:

- `compatible`
- `compatible_with_conditions`
- `uncertain`
- `blocked`
- `insufficient_evidence`

## Deterministic aggregation order

The physical-fit layer aggregates rule results in this fixed order:

1. **Any failed blocking rule** → `blocked`
2. **No failed blocking rule, but required critical evidence is missing** → `insufficient_evidence`
3. **No failed blocking rule and no missing critical evidence, but unresolved conditional issues remain** → `compatible_with_conditions`
4. **All required checks pass with adequate evidence** → `compatible`

`uncertain` is reserved for unusual states where the engine cannot place the result into one of the more precise outcomes with confidence.

## Why weighted scores are prohibited

Weighted scores and compatibility percentages are intentionally excluded.

A failed blocking rule must never be averaged away by several passing checks. A percentage display can imply false precision, hide the importance of missing evidence, and encourage unsafe interpretation. This prototype instead shows the controlling rule outcome and the next action required.

## Unknown is not failure

Unknown values are handled separately from failures.

- A **failure** means the rule condition was checked and a conflict was confirmed.
- An **unknown** means the engine does not have enough reliable information to evaluate the rule confidently.

Critical unknowns drive `insufficient_evidence`. Non-critical unknowns can still lead to `compatible_with_conditions` when the remaining issue should be resolved before purchase or installation.

## How the rule types differ

### Blocking

Blocking rules describe confirmed physical conflicts such as excess height, wrong terminal type, or reversed polarity orientation.

### Conditional

Conditional rules identify unresolved matters such as unknown cable reach, unresolved family variants, or missing terminal-view evidence.

### Informational

Informational rules provide context such as tighter remaining clearance or a different case style that is not yet known to prevent fit.

## Example decision flow

1. Candidate height is 190 mm.
2. Confirmed compartment height is 175 mm.
3. The height blocking rule evaluates to `fail`.
4. Aggregation stops at the first governing state: `blocked`.

A different example:

1. Candidate height is known.
2. Compartment height is missing.
3. No blocking conflict is confirmed.
4. Critical evidence for the height rule is incomplete.
5. Outcome becomes `insufficient_evidence`.

This keeps the model truthful, deterministic and auditable.
