# AMIRA — Founder verification (Grasshopper)

**Mission is not complete until you can test it.** Here is everything to do that.

## Access

**Option A — one command locally (works right now):**

```bash
cd amira
# one-time: build UI + install backend
cd ui && npm ci && npm run build && cd ..
cd backend && python -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt && cd ..
# run
uvicorn main:app --app-dir backend --port 8000
```

Open **http://localhost:8000**.

**Option B — staging (Render):** the repo ships `render.yaml`. In Render → *New → Blueprint*
→ pick the `amira` repo → *Apply*. It builds the UI and backend and gives a URL like
`https://amira.onrender.com`. `OPENAI_API_KEY` is optional (the hero demo is fixtures-first
and does not need it). *This one click needs a Render account with dashboard access — I do
not have Render API access in this environment, so it is the only step I cannot do for you.*

## Exact deterministic demo selections

On **Check the Evidence**, either click **Run the hero example**, or set:

| Field | Value |
|---|---|
| Condition | Cardiovascular disease |
| Medicine | **Atorvastatin** |
| Life stage | **Postmenopause** |
| Menopausal hormone therapy | Not specified |

→ **CHECK THE EVIDENCE**. Result: **LIMITED** evidence completeness, 27% women, efficacy
analyzed by sex = Yes, safety/menopause/hormonal/HT = not reported.

Two more one-click cases (buttons under the form):
- **Icosapent ethyl + HT** → *No evidence found* state (🔍).
- **Menopausal hormone therapy** → *Evidence of no effect* state (⚖️).

## Labels you will see (honest data labeling)

- **Verified demo data** — seeded, human-checked fixture (never shown as live).
- **Human verified** — reviewed against the cited source.
- **AI extracted** — produced by the extraction model (schema + citation validated).
- **Live source** — fetched live (used when a live API is wired).

## 5-minute founder checklist

- [ ] Page loads at the URL
- [ ] The user question is obvious ("Was this medicine actually studied in women like me?")
- [ ] Check the Evidence works (hero example)
- [ ] Dashboard appears with the LIMITED completeness classification
- [ ] Evidence cards show 27% women, efficacy = Yes, menopause = Not reported
- [ ] "What we found" and "What is still missing" are both understandable
- [ ] Source drawer opens (click any card or "Open all sources") and shows passages + links
- [ ] No unsupported clinical claim appears (no "safe", no "best", no dose advice)
- [ ] "No evidence found" and "Evidence of no effect" show different messages
- [ ] Benchmark page ("How AMIRA performs") loads with metrics
- [ ] Mobile layout is usable (no sideways scrolling)

## The takeaway to remember

**High female representation does not automatically mean complete women-specific or
hormone-aware evidence.** The hero shows it: women *were* included and efficacy *was*
analyzed by sex — but sex-specific safety, menopausal status, and hormonal context were
never reported. AMIRA makes that gap visible, with every claim linked to its source.

## Notes on visual proof

Screenshot capture times out in the current build environment (a known quirk here), so
verification was done against the live DOM: the hero dashboard, source drawer (3 sources
with passages, PubMed/DailyMed links, confidence meters), both safety-state banners, the
benchmark page, and a mobile pass (no horizontal overflow) were all confirmed rendering
correctly with zero console errors. Re-run Option A to see it live in under a minute.
