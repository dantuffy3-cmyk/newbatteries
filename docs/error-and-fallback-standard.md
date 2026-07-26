# Error and fallback standard

## Customer-safe error language
- Use calm, plain language.
- Do not imply a request was sent when no transmission exists.
- Approved technical fallback text: **The identification data could not be loaded.**
- Approved unknown-code text: **The code was not recognised in the current reference data.**

## Unknown data vs technical failure
- Unknown/unsupported code means reference data loaded, but no current match was found.
- Technical failure means data or scripts could not load, were malformed, or initialization failed.
- Never present technical loading failures as unknown-code outcomes.

## Safe presentation rules
- Do not show raw developer errors, stack traces, or JSON payloads to customers.
- Do not show false success states.
- Do not show false submission states (success or failure) when no online submission exists.

## Input preservation and recovery
- Preserve entered data where practical during validation and recoverable failures.
- Keep the user on the current step when validation fails and provide actionable guidance.
- For offline/failed-data behavior, provide refresh and return-path guidance.

## Accessibility requirements for errors
- Error summaries must be keyboard focusable and receive focus when shown.
- Field-level errors must remain associated with the relevant controls.
- Include clear text labels; do not rely on color alone.
- Keep hidden inactive states out of assistive announcements.
