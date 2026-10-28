# cbsouthfbla — CB South FBLA Objective Test Bank

A free, static study site for CB South FBLA members. Pick any FBLA event with an objective test, choose topics, then study four ways:

- **Quiz** — one question at a time with instant feedback and explanations
- **Flashcards** — flip cards, sort into "got it" and "still learning"
- **Test** — timed like competition (100 questions / 50 minutes by default), questions drawn using the official 2026–27 topic weights, scored by topic at the end
- **Browse all** — every question and answer, searchable

Progress (missed questions, accuracy per event) is saved in each student's browser. No accounts, no server, no cost.

## What's in the bank

| | |
|---|---|
| Events | 45 current 2026–27 events with an objective test (including the test portion of role-play events) plus 6 retired events for extra practice |
| Past-test questions | ~6,800 from past FBLA district/state tests and the 2008–10, 2010–13, 2013–16 and 2017–20 competitive events study guides |
| Practice questions | ~1,850 written for this site from the official 2026–27 study-guide objectives, mainly for events that have no past tests (Data Science & AI, Real Estate, HR Management, Project Management, etc.) |

Every question is tagged **past test** or **practice** on the site so members always know where it came from. Topics are the official knowledge areas from the 2026–27 Competitive Events Guidelines.

**Accuracy notes.** Answer keys come from the original documents. Keys from scanned (OCR'd) study guides were reviewed by hand and about 40 wrong keys were fixed; a random sample of the typed tests showed roughly a 2% key-error rate. If a member spots a wrong answer, the **Report a problem** link on each question opens a pre-filled GitHub issue.

## Deploy on GitHub Pages (5 minutes)

1. Create a new public repository named **`cbsouthfbla`** on GitHub.
2. Upload everything in this folder (keep the folder structure: `index.html`, `assets/`, `data/`, `tools/`, `.github/`, `.nojekyll`).
   - Easiest: on the repo page click **Add file → Upload files** and drag the whole folder contents in, then **Commit**.
3. Go to **Settings → Pages**. Under *Build and deployment*, set **Source: Deploy from a branch**, **Branch: `main`**, folder **`/ (root)`**, then **Save**.
4. After a minute the site is live at `https://<your-username>.github.io/cbsouthfbla/`.
5. In `index.html`, set `repo:` to your repo URL (it is preset to `https://github.com/atharvab7/cbsouthfbla`) so "Report a problem" links work.

To preview locally: `python3 -m http.server` in this folder, then open http://localhost:8000 (opening `index.html` directly from disk will not load the data).

## How the question database is managed

The bank is plain JSON in the repo — no database server needed, and GitHub keeps full history of every change.

```
data/
  events.json            # catalog: event names, categories, official topics & weights, counts
  q/<event-id>.json      # one file per event: {"event", "topics": [...], "questions": [...]}
tools/
  build_index.py         # validates every question file and refreshes counts in events.json
  import_csv.py          # adds questions from a CSV (e.g. exported from a Google Sheet)
  example_import.csv     # template
.github/workflows/validate.yml   # runs build_index.py on every push so broken data never ships
```

Each question looks like:

```json
{"id": "a1b2c3d4", "t": 2, "q": "Question text", "o": ["A", "B", "C", "D"], "a": 1,
 "x": "optional explanation", "s": "source label", "k": "o"}
```

`t` = index into that event's `topics`, `a` = index of the correct option, `k` = `"o"` past test or `"p"` practice.

### Adding questions (recommended workflow for officers)

1. Keep a shared Google Sheet with the columns in `tools/example_import.csv`:
   `event, topic, question, A, B, C, D, E, answer, explanation, source, kind`
2. Download it as CSV and run `python3 tools/import_csv.py new_questions.csv`.
   Duplicates are skipped; unknown topics go to "General / mixed".
3. Commit and push. The GitHub Action validates the bank automatically.

### Fixing a wrong answer

Open `data/q/<event-id>.json`, search for the question text or its `id` (shown in the issue from "Report a problem"), change `"a"` to the correct option index (0 = A, 1 = B, …), then run `python3 tools/build_index.py`.

## Not affiliated with FBLA

Built by CB South FBLA for chapter study. Not an official FBLA product. Official sample test items for each event are in FBLA Connect.
