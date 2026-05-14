# _src/ — Private source materials

This directory is intentionally empty in the public repo. It holds **private**
ĒSO + FSC source files that the parser reads to regenerate
`src/data/modules.json`. The generated JSON is what the app ships with; the
source files themselves stay out of version control.

## Repopulating on a fresh machine

You need three files to re-run the parser:

| File | What it is | Where it lives |
|---|---|---|
| `tchart.xlsx` | `FSC_ESO_Post_Readout_Deliverables_TChart_v1.xlsx` | FSC Google Drive · ESO/Outbrief/ |
| `matrix.xlsx` | `FSC_ESO_Automation_Opportunity_Matrix_v1.xlsx` | FSC Google Drive · ESO/Outbrief/ |
| `brand_guide.pdf` | `ĒSO_BrandGuide (1).pdf` (Winter 2026) | FSC Google Drive · ESO/AI Consult/ |

Drop them into this folder with those exact filenames, then:

```bash
npm run parse        # writes src/data/modules.json
```

Commit the regenerated `modules.json`. The xlsx/pdf source files stay
ignored by git (see `.gitignore`).

## Why isolate them?

- The T-chart contains ROM pricing and hours-saved estimates that are scoped
  to FSC's engagement with ĒSO — not appropriate for a public repo.
- The Brand Guide PDF is licensed work by Gold Lunchbox + Peel Strategy + Prize
  Fight on behalf of ĒSO.

The generated `src/data/modules.json` is fine to publish — that's the user-facing
data that ships in the app anyway.
