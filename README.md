# newbatteries
An Australian battery identification and supplier connection platform helping people find the right replacement battery without the guesswork.
GitHub Pages deployment enabled.

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
