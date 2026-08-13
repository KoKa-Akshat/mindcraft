# MindCraft social assets (2026-08-11)

Brand palette locked (from `BRAND_BOOK.md`):

| Token | Hex |
|-------|-----|
| Deep Field | `#080e14` |
| Chalk | `#f5f5f5` |
| The Click (lime) | `#c4f547` |
| Depth (navy) | `#1d3a8a` |

Built in code and palette-locked so colors cannot drift. The exported PNGs contain only the four exact RGB values above.

## Upload these

| File | Use | Spec |
|------|-----|------|
| `mindcraft-x-avatar-400.png` | X profile photo | 400×400 |
| `mindcraft-x-banner-1500x500.png` | X header | 1500×500 |
| `mindcraft-linkedin-banner-1584x396.png` | LinkedIn personal profile background, RGB PNG | 1584×396 |
| `mindcraft-linkedin-banner-1584x396.jpg` | LinkedIn personal profile fallback | 1584×396 |
| `mindcraft-linkedin-company-cover-1128x191.png` | LinkedIn company Page cover, RGB PNG | 1128×191 |
| `mindcraft-linkedin-company-cover-1128x191.jpg` | LinkedIn company Page fallback | 1128×191 |

The X and LinkedIn compositions are intentionally different. Each respects the platform's profile-photo obstruction and responsive crop while keeping the central promise readable.

Use the `1584×396` file on a personal profile. Use the `1128×191` file on the MindCraft company Page. The PNG files are standard 24-bit RGB rather than indexed-color PNGs; choose the matching JPG only if LinkedIn's uploader still rejects the PNG.

## Rebuild

```bash
python3 agent_work/product/social_x_2026-08-11/build_social_banners.py
```

## Website link looking weird (`t.co/…`)

X **always** rewrites the Website field to a `t.co` short link. Normal, not a domain bug.

Tip: put `joinmindcraft.com` in the **bio** as plain text; keep Website as `https://joinmindcraft.com` for the click.
