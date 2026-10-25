# NewBatteries

NewBatteries is an Australian battery identification prototype.

The public repository contains the static product experience for:
- the homepage
- the Battery Finder
- the Compatibility Check
- the Physical Fit Lab

The product is intentionally conservative:
- online submission is not enabled
- results are preliminary
- compatibility and fitment must still be verified before purchase or installation
- missing information is treated as unknown, not as confirmation

## Public repository scope

This repository is for the public website and its public runtime assets.
It does not document private review workflows or internal governance material.

## Run the public regression suite

```bash
npm test
```

This runs the Playwright browser regression checks for the public product pages and production script loading.
