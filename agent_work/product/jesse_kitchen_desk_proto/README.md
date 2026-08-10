# Jesse’s Kitchen · Field Desk proto

Localhost mock: iPad landscape Field Desk with Jesse’s Kitchen as a Learn zone on the same desk surface (ACT map · story practice · resume / workflows).

## Run

```bash
cd /Users/akoirala/Developer/mindcraft/agent_work/product/jesse_kitchen_desk_proto
python3 -m http.server 8765
```

Open: [http://localhost:8765](http://localhost:8765)

## Try

- Drag the dark desk canvas (or trackpad scroll) to pan.
- Tap **Jesse’s Kitchen** for the diagnostic intro overlay.
- Tap **Learn · Binder** to open the landscape Learn dash inside the pad.
- Tap the raccoon / MindCraft wordmark (or Connect → Set up Google) for Drive / Gmail / Calendar steps.
- Prefer landscape. Portrait phones get a rotate hint; the pad stays a 4:3 landscape frame.

## Files

| Path | Role |
|------|------|
| `index.html` | iPad frame + desk cards |
| `styles.css` | Field / cream / lime look |
| `app.js` | Pan + modals |
| `img/jesse-kitchen-intro.jpg` | Kitchen intro art |
| `img/kitchen-warm.jpg` | Zone card art |
| `img/mascot.png` | Raccoon hit target |
| `img/mindcraft-logo.png` | Brand asset |

Prototype only. Does not touch live marketing `index.html`.
