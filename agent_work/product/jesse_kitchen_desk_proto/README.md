# Jesse’s Kitchen · Field Desk proto (real 3D)

Localhost mock: iPad landscape Field Desk with the **live Jesse’s Kitchen 3D world** (`worlds/world2`, Ramen Shop by Jesse Zhou from GitHub) opening inside the same iPad screen.

## Run (from repo root — required)

The 3D world lives at `worlds/world2/`. Serve the whole MindCraft repo so the desk proto can iframe it:

```bash
cd /Users/akoirala/Developer/mindcraft
python3 -m http.server 8765
```

Open: [http://localhost:8765/agent_work/product/jesse_kitchen_desk_proto/](http://localhost:8765/agent_work/product/jesse_kitchen_desk_proto/)

Direct kitchen (same asset): [http://localhost:8765/worlds/world2/?embed=1](http://localhost:8765/worlds/world2/?embed=1)

Wait for the loading % to finish, then tap **Enter World →**.

> Note: the Three.js bundle must load `basis/` + `draco/` relative to `worlds/world2/` (patched). Serving only the proto folder (not the repo root) will still break the kitchen.

Live host fallback: https://mindcraft-world1.web.app/

## Try

- Drag the dark desk canvas (or trackpad scroll) to pan.
- Tap **Jesse’s Kitchen** → the real Three.js kitchen fills the iPad. **← Desk** returns.
- Tap **Learn · Binder** for the landscape Learn dash.
- Tap the raccoon / wordmark for Drive / Gmail / Calendar steps.
- Prefer landscape.

## Source

| Path | Role |
|------|------|
| `worlds/world2/` | Jesse Zhou Ramen Shop Three.js world (MindCraft Study World 2) |
| `img/kitchen-3d-preview.png` | Card preview (from `worlds/world2/image.png`) |
| `index.html` / `styles.css` / `app.js` | iPad Field Desk shell |

Prototype only. Does not modify locked `worlds/world2/` sources.
