# NewBatteries

An Australian battery identification and supplier connection platform helping people find the right replacement battery without the guesswork.
GitHub Pages deployment enabled.

## Enabling live form submission

The Battery Finder sends completed enquiries to NewBatteries for manual review. Submission uses [Formspree](https://formspree.io) as the first backend. No email address is stored in the public code.

### 1. Create a Formspree form

1. Sign in to [formspree.io](https://formspree.io).
2. Create a new form. Give it a name like "NewBatteries enquiry".
3. Under **Form endpoint**, copy the URL — it will look like `https://formspree.io/f/xyzabcde`.
4. In the Formspree dashboard, enable **email notifications** so you receive a copy of each submission.

### 2. Insert the endpoint

Open `assets/js/finder.js` and find the configuration block near the top of the file:

```js
var FORM_ENDPOINT = 'FORM_ENDPOINT_PLACEHOLDER';
```

Replace the placeholder string with your Formspree URL:

```js
var FORM_ENDPOINT = 'https://formspree.io/f/xyzabcde';
```

Commit and push. That is the only change required to enable live submission.

### 3. Enable domain restriction and spam protection

In the Formspree dashboard for your form:

- **Allowed origins**: add `https://yourdomain.github.io` (or your custom domain). This prevents other sites from submitting to your endpoint.
- **Enable reCAPTCHA**: Formspree supports reCAPTCHA v2/v3 — enable it once your domain is confirmed. Do not add reCAPTCHA client-side code until the Formspree project is configured.
- The finder already includes a **honeypot field** (`_gotcha`). Formspree rejects any submission where this hidden field is non-empty (bots often fill all fields).
- **Email notifications**: configure forwarding rules in Formspree so you can triage enquiries in your preferred inbox.

### 4. Testing success and failure states

**Test success (placeholder mode — no endpoint needed)**

1. Open `finder.html` in a browser.
2. Complete all steps through to the Review page.
3. Tick the privacy consent checkbox and click **Send request to NewBatteries**.
4. Because `FORM_ENDPOINT` is still `FORM_ENDPOINT_PLACEHOLDER`, the finder moves to the confirmation page and shows **"Your battery request is ready"** — no data is transmitted.

**Test success (with a real or mocked endpoint)**

- Set `FORM_ENDPOINT` to your Formspree URL, or to a local mock server (e.g. `http://localhost:3000/mock`).
- Complete the finder and submit. On a `200 OK` response the page should show **"Request received"** with the request reference and date.

**Test failure handling**

- Temporarily set `FORM_ENDPOINT` to a URL you know will fail (e.g. `https://httpstat.us/500`).
- Submit the finder. The confirmation page should show the error state with a message and a **"Try again"** button.
- All answers should remain intact and the request reference should be retained.
- Clicking **"Try again"** returns to the review step so the user can re-submit.

**Other checks before going live**

- Double-click **Send request to NewBatteries** rapidly: the button disables immediately after the first click so only one request is sent.
- Leave the privacy consent box unticked and click **Send request**: an error message appears and submission is blocked.
- Click **Copy request summary** and paste into a text editor to confirm all fields are included.
- Click **Print or save summary** and confirm the browser print dialog opens with a readable layout.

---

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

## Battery Intelligence Core

NewBatteries now includes a conservative Battery Intelligence Core for battery master data, relationship records and evidence-led compatibility checks.

### Architecture overview

The core is made up of:
- `data/batteries.json` — battery master records, including backward-compatible finder fields plus new structured fields
- `data/relationships.json` — explicit relationship records between batteries or battery ecosystems
- `data/rule-profiles.json` — category-specific compatibility rule profiles
- `data/sources.json` — source register and evidence authority metadata
- `data/battery-record-schema.json` — JSON Schema for battery records
- `assets/js/battery-data.js` — browser-safe loader and normaliser for battery datasets
- `assets/js/compatibility-engine.js` — rules-based compatibility assessment engine
- `compatibility.html` — UI for comparing two battery codes

### File descriptions

- `batteries.json` remains the source of truth for the existing finder. New records must keep the old fields (`id`, `canonicalCode`, `aliases`, `family`, `category`, `nominalVoltage`, `typicalApplications`, `chemistryOptions`, `warnings`, `verificationRequirements`) so `finder.js` keeps working.
- `relationships.json` is intentionally conservative. It stores only explicit relationship records with warnings, unknowns, confidence and verification requirements.
- `rule-profiles.json` defines which checks are blocking, conditional or informational for each category.
- `sources.json` documents source classes and their permitted use. It does not grant any scraping or republication rights.
- `battery-record-schema.json` is the validation reference for structured battery records.

### How to add a battery record

1. Add the record to `data/batteries.json` following `data/battery-record-schema.json`.
2. Keep all backward-compatible finder fields present so the existing finder can still read the record.
3. Start conservative: use `reviewStatus: "draft"` unless the record has passed review.
4. Populate `unknowns` with anything that is missing, conflicting or still unverified.
5. Leave `manufacturerSpecifications` empty unless you have source-backed manufacturer detail.

### How to add a relationship record

1. Add an explicit record to `data/relationships.json`.
2. Describe what matches, what differs, the warnings, the unknowns and the required verification steps.
3. Use `relationshipType`, `classification`, `confidence` and `reviewStatus` conservatively.
4. Only use `direct_equivalent` when an approved relationship explicitly supports it.

### Approval workflow

Records should move from `draft` to `reviewed` to `approved` using the process in `docs/verification-workflow.md`. Evidence governance rules are defined in `docs/evidence-governance.md`.

### How the compatibility engine works

`assets/js/compatibility-engine.js` loads normalised batteries, relationships, rule profiles and sources via `assets/js/battery-data.js`. It then:
- looks up both codes conservatively
- checks for an explicit relationship record
- applies category rule profiles
- treats missing data as unknown, not as a match
- never generates compatibility percentages
- only returns `direct_equivalent` when an approved explicit relationship says so

### Current limitations

- The dataset is still incomplete and many records remain draft or reviewed rather than approved.
- Source IDs are placeholders until evidence is linked per record.
- Relationship coverage is intentionally narrow.
- The engine does not guarantee fitment, safety or supplier availability.
