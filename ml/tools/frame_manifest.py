#!/usr/bin/env python3
"""
Emit the Frame manifest: the McCreary corpus as world content.

A Frame, in the voxel world, is a runnable simulation you can hold, inspect,
and slot into things. `docs/canon/STORY_NORTH_STAR.md` section 3 specifies its
face: a name plate, a live window, one unit-stamped dial per input port, a
maker's seal, and stated limitations.

This turns 4,061 existing simulations into that, at the fidelity each one
actually supports, and refuses to overstate any of them.

Three tiers, and the tier is a promise about what the Frame can do:

    display   it renders and runs. Nothing outside can change it. 
    input     its sliders were recovered, so the Frame's dials are real and
              turning one changes what you see.
    dataflow  its outputs feed another Frame. No sim in this corpus declares
              outputs, so nothing reaches this tier automatically, ever.

The tier is on the card. A student holding a display Frame can see that it has
no dials, which is honest, and better than dials that do nothing.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

REPO = Path("/Volumes/SSK SSD/Developer/mindcraft")
GENERATED = REPO / "agent_work/scoping/generated"
MIRROR = REPO / "agent_work/product/archive_mirror/out"

# Attribution is not optional and is not a footnote. Every Frame carries its
# maker's seal, which is a canon requirement and a licence requirement at the
# same time, which is a pleasant thing to be able to say.
ATTRIBUTION = "Dan McCreary, open intelligent textbook"


def tier_for(sim: dict) -> str:
    """Recomputed here because it is a property on the indexer's dataclass and
    properties do not survive `asdict`. Same rule, stated once more: only a p5
    sketch that follows the full template and exposes readable sliders can be
    driven by the generic shim."""
    if sim["kind"] != "p5":
        return "display"
    return "input" if sim["sliders"] and sim["follows_template"] else "display"


def title_from_slug(slug: str) -> str:
    """`pn-junction-voltage-explorer` -> `Pn Junction Voltage Explorer`.

    Deliberately dumb. A generated title that is merely tidy beats a clever one
    that is sometimes wrong, and these get reviewed before they ship anyway.
    """
    return " ".join(word.capitalize() for word in slug.replace("_", "-").split("-"))


def main() -> None:
    sims = json.loads((GENERATED / "sim_corpus_index.json").read_text())

    # Per-repo attribution and source URL, so a Frame can always point home.
    sources: dict[str, dict] = {}
    for manifest_path in MIRROR.glob("*/manifest.json"):
        try:
            data = json.loads(manifest_path.read_text())
        except json.JSONDecodeError:
            continue
        sources[manifest_path.parent.name] = {
            "source_url": data.get("source_base_url", ""),
            "attribution": data.get("attribution", ATTRIBUTION),
        }

    frames = []
    for sim in sims:
        repo, slug = sim["repo"], sim["slug"]
        source = sources.get(repo, {})
        local = MIRROR / repo / "sims" / slug / "main.html"

        # A dial is only real if we recovered its bounds. Anything we could not
        # read does not get a dial, rather than getting a fake one.
        dials = [
            {
                "port": s["name"],
                "min": s["min"],
                "max": s["max"],
                "default": s["default"],
                "step": s["step"],
                # Units are the one thing the corpus never states, and the unit
                # rule forbids silent conversion. So every dial ships unitless
                # and explicitly marked, and a Frame with unitless dials cannot
                # be wired to another Frame. It can still be turned and watched.
                "unit": None,
            }
            for s in sim["sliders"]
        ]

        frames.append(
            {
                "id": f"frame.mccreary.{repo}.{slug}",
                "title": title_from_slug(slug),
                "tier": tier_for(sim),
                "runtime": sim["kind"],
                "embed": {
                    "local_path": str(local.relative_to(REPO)) if local.exists() else None,
                    "source_url": f"{source.get('source_url', '').rstrip('/')}/sims/{slug}/",
                },
                "dials": dials,
                "outputs": [],  # nothing in this corpus declares any
                "concepts": sim["concepts"],
                "subjects": sim["subjects"],
                "provenance": {
                    "maker": ATTRIBUTION,
                    "repo": repo,
                    "rigor": "studied",  # authored and published, not yet checked against the world
                    "licence": "see LICENCE_STATUS.md, grant pending in writing",
                },
                # Stated plainly on the card, per the fifth writing law. A
                # model that will not say where it stops is a wish.
                "limitations": [
                    "Ports are unitless, so this Frame cannot be wired to another Frame.",
                    "Limitations were not captured by the mirror. See the source page.",
                ],
            }
        )

    tiers = Counter(f["tier"] for f in frames)
    runnable = sum(1 for f in frames if f["embed"]["local_path"])
    with_concepts = sum(1 for f in frames if f["concepts"])
    with_dials = sum(1 for f in frames if f["dials"])

    (GENERATED / "frame_manifest.json").write_text(json.dumps(frames, indent=1))

    print(f"frames emitted     : {len(frames)}")
    print(f"  playable locally : {runnable}")
    print(f"  with real dials  : {with_dials}")
    print(f"  concept-anchored : {with_concepts}")
    print(f"  tiers            : {dict(tiers)}")
    print()
    print("ready to ship as display Frames today:", tiers["display"])
    print("ready as drivable Frames today       :", tiers["input"])
    print()
    print("written to", GENERATED / "frame_manifest.json")


if __name__ == "__main__":
    main()
