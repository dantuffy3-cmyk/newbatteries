# NewBatteries

An Australian battery identification and supplier connection platform helping people find the right replacement battery without the guesswork.
GitHub Pages deployment enabled.

## Landing page experience

The homepage (`index.html`) is a radically simplified battery-intelligence interface centred on one question: **"What needs power?"**

### How the homepage works

Users begin by describing their item, entering a model, entering a battery/part number, or uploading a photograph — no forced category selection.

The single hero identification control routes users into the battery finder (`finder.html`) via simple transparent keyword routing:

| Entry | Detected pattern | Route |
|-------|-----------------|-------|
| Short alphanumeric with no spaces matching battery-code format (e.g. `LN2`, `DIN66`, `N70`) | Battery code | `finder.html?path=number&query=…` |
| Multi-word query or known equipment brand/model | Equipment description | `finder.html?path=equipment&query=…` |
| Photograph button | Photo pathway | `finder.html?path=photo` |
| Uncertain or unclassifiable | Not sure pathway | `finder.html?path=notsure&query=…` |

The entered value is preserved via the `query` URL parameter and pre-filled in the appropriate finder field. No battery result is invented; no AI analysis is claimed.

### Design system

NewBatteries now uses a shared **energy-spectrum** token set across homepage and finder:

`--energy-red #FF5C62`, `--energy-orange #FF8A34`, `--energy-amber #FFC247`, `--energy-green #A8F238`, `--energy-cyan #45DCE8`, `--energy-blue #5F8CFF`, `--energy-violet #A56EFF`.

Core dark-surface tokens remain:

`--void #070908`, `--carbon #101412`, `--panel #161B19`, `--battery-white #F5F7F5`, `--muted-text #A5ADA8`.

| Token | Value | Use |
|-------|-------|-----|
| void black | `#070908` | Hero background |
| carbon | `#101412` | Section backgrounds |
| battery white | `#F5F7F5` | Primary text / surfaces |
| ion green | `#B6FF3B` | Identification / completion |
| electric cyan | `#62E7FF` | Scanning / data / intelligence |
| caution amber | `#FFB547` | Warnings / confirmation required |
| low-charge red | `#FF6262` | Errors / low confidence |

### Finder visual upgrade

`finder.html` now uses the same dark battery-intelligence styling language as the homepage:
- dark panel/surface system with illuminated focus and active-step accents
- 6-segment battery progress rail with step text (`Step X of 6`)
- custom inline SVG category marks (emoji removed)
- pathway-coloured controls, radio cards, and technical field states
- upgraded preliminary identification, review, and confirmation presentation while preserving all existing finder logic and routing behaviour

### Page structure

1. Minimal header with wordmark, nav links, and "Identify a battery" CTA
2. Hero with single large identification control (text + photo + submit)
3. Three pathway panels (Show us / Tell us / Enter the code)
4. Clearly labelled example identification (demonstration only, not live)
5. Trust principles ("Identification before recommendation.")
6. Optional equipment browser (expandable, grouped by category)
7. Supplier network invitation
8. Minimal footer

### Accessibility

- Semantic HTML5 landmarks throughout
- Keyboard-operable — all controls reachable and activatable by keyboard
- Visible focus states on all interactive elements
- Screen-reader labels on all SVG marks and icon buttons
- `prefers-reduced-motion` respected for all animations
- Minimum 44 px touch targets
- No horizontal overflow at 360 px viewport
- Example result labelled as non-live to avoid false impressions

## Battery Match Result V1 manual test guidance

Run these browser-based checks in `finder.html`:

1. **Exact recognised code**: enter `DIN66` and confirm a likely identification is shown.
2. **Normalised code**: enter `din-66 mf` and confirm it is treated as related to DIN66.
3. **Family match**: enter an LN2 variation (for example `ln 2`) and confirm a family-level result is shown.
4. **Recognised code with missing dimensions**: use a recognised code but leave dimensions blank; confirm unknowns are listed.
5. **Unknown code**: enter an unrecognised code and confirm the respectful “could not confidently recognise” guidance appears.
6. **Conflicting voltage**: enter a DIN/LN/NS/N style code with a conflicting voltage (for example 24V) and confirm conflict messaging with lower confidence.
7. **Start-stop with non-confirmed AGM/EFB**: select start-stop `Yes` with non-AGM chemistry and confirm conflict/low-confidence warning.
8. **Improve result flow**: generate a low/medium result and click **Improve this result**; confirm it returns to uncertain inputs while preserving existing answers.
9. **Restart flow**: click **Start again** and confirm finder state is cleared.
10. **Print summary**: click **Print or save result** on mobile and desktop widths; confirm result summary prints while nav/controls are hidden.
