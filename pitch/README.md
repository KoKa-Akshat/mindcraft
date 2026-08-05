# MindCraft Pitch (canonical)

**Revised Aug 2026** after BETA Demo Night feedback (Joe + Dylan).

| File | Use |
|------|-----|
| [`MindCraft_Pitch.pdf`](./MindCraft_Pitch.pdf) | Deck to send / present |
| [`index.html`](./index.html) | Editable visual deck (open in browser) |
| [`PITCH_SCRIPT.md`](./PITCH_SCRIPT.md) | 2-min elevator + 4-min duo script |
| [`OUTREACH.md`](./OUTREACH.md) | Follow-up email + one-liner |
| [`build_pdf.py`](./build_pdf.py) | Regenerate PDF after edits |

## Edit the deck

1. Tweak copy/layout in `index.html` (or `build_pdf.py` for the PDF layout).
2. Swap screenshots in `img/`.
3. Rebuild PDF:

```bash
cd pitch && python3 build_pdf.py
```

## Preview HTML locally

```bash
cd pitch && python3 -m http.server 8766 --bind 127.0.0.1
```

Open http://127.0.0.1:8766/

## Ask an agent later

> Open the MindCraft pitch in `pitch/` and revise slide N / the outreach email / the 2-min elevator.
