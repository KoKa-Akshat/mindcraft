#!/usr/bin/env python3
"""Build a catalog of public-domain folk tale stubs for the story-skin engine.

Sources (no HTML scraping):
  1. Gutendex (https://gutendex.com) — a public JSON API that mirrors Project
     Gutenberg's catalog metadata (title, authors, subjects, auto-generated
     summaries, format URLs). This IS the "Project Gutenberg search API" in
     JSON form; the legacy `gutenberg.org/ebooks/search.json` endpoint no
     longer resolves (404 as of this writing; verified against the live site),
     so we hit its modern JSON replacement instead. No page HTML is fetched or
     parsed anywhere in this script.
  2. A curated, hard-coded list of ~80 culturally diverse public-domain tales
     (Anansi, Panchatantra, Jataka, Norse, Celtic, Japanese, Korean, Mexican,
     Persian, Indian, African, Native American, ...) with hand-written
     one-paragraph synopses, for cultures thin on Gutendex's English-language
     catalog.

Output: ml/data/folk_tales/folk_catalog.json — an array of catalog stubs.
Enrichment (math_theme_tags, concept_affinity_scores, math_skin_score) is
deliberately left blank here; that's folk_tale_collector.py's job.

CLI:
    python3 ml/scripts/build_folk_catalog.py               # build + write
    python3 ml/scripts/build_folk_catalog.py --dry-run     # count only
    python3 ml/scripts/build_folk_catalog.py --out PATH    # custom output
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import socket
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ML_DIR = SCRIPT_DIR.parent
DEFAULT_OUT = ML_DIR / "data" / "folk_tales" / "folk_catalog.json"

GUTENDEX_BASE = "https://gutendex.com/books/"
USER_AGENT = "mindcraft-folk-catalog/1.0 (+https://joinmindcraft.com; research use)"

# Per-query culture/region hints used when a result's own subjects don't name
# a country/tradition explicitly. Keep queries specific enough that most hits
# are genuinely folklore/mythology collections, not unrelated novels.
SEARCH_QUERIES = [
    {"query": "African folk tales", "culture": "African (various)", "region": "Africa"},
    {"query": "West African folklore", "culture": "West African", "region": "West Africa"},
    {"query": "Native American legends", "culture": "Native American (various)", "region": "North America"},
    {"query": "Iroquois legends", "culture": "Iroquois", "region": "North America"},
    {"query": "Japanese fairy tales", "culture": "Japanese", "region": "East Asia"},
    {"query": "Chinese fairy tales", "culture": "Chinese", "region": "East Asia"},
    {"query": "Korean folk tales", "culture": "Korean", "region": "East Asia"},
    {"query": "Celtic fairy tales", "culture": "Celtic", "region": "British Isles"},
    {"query": "Irish fairy tales", "culture": "Irish", "region": "British Isles"},
    {"query": "Norse mythology", "culture": "Norse / Scandinavian", "region": "Northern Europe"},
    {"query": "Russian fairy tales", "culture": "Russian", "region": "Eastern Europe"},
    {"query": "Persian tales", "culture": "Persian", "region": "Middle East"},
    {"query": "Arabian nights", "culture": "Arabian / Middle Eastern", "region": "Middle East"},
    {"query": "Indian fairy tales", "culture": "Indian", "region": "South Asia"},
    {"query": "Hindu mythology tales", "culture": "Indian", "region": "South Asia"},
    {"query": "Jewish fairy tales", "culture": "Jewish", "region": "Middle East / Diaspora"},
    {"query": "Egyptian mythology", "culture": "Egyptian", "region": "North Africa"},
    {"query": "Mexican legends", "culture": "Mexican", "region": "Mesoamerica"},
    {"query": "Hawaiian legends", "culture": "Hawaiian / Polynesian", "region": "Pacific"},
    {"query": "Filipino folklore", "culture": "Filipino", "region": "Southeast Asia"},
    {"query": "Slavic fairy tales", "culture": "Slavic", "region": "Eastern Europe"},
    {"query": "Finnish mythology", "culture": "Finnish", "region": "Northern Europe"},
    {"query": "Grimm fairy tales", "culture": "German", "region": "Western Europe"},
    {"query": "Italian folk tales", "culture": "Italian", "region": "Mediterranean Europe"},
    {"query": "French fairy tales", "culture": "French", "region": "Western Europe"},
    {"query": "Scottish folk tales", "culture": "Scottish", "region": "British Isles"},
    {"query": "Welsh fairy tales", "culture": "Welsh", "region": "British Isles"},
    {"query": "Australian aboriginal legends", "culture": "Aboriginal Australian", "region": "Oceania"},
    {"query": "Inuit legends", "culture": "Inuit", "region": "Arctic North America"},
    {"query": "Brazilian folklore", "culture": "Brazilian", "region": "South America"},
    {"query": "Turkish fairy tales", "culture": "Turkish", "region": "Middle East"},
    {"query": "Spanish folk tales", "culture": "Spanish", "region": "Mediterranean Europe"},
    {"query": "Scandinavian folk tales", "culture": "Scandinavian", "region": "Northern Europe"},
    {"query": "Greek mythology tales", "culture": "Greek", "region": "Mediterranean Europe"},
    {"query": "Aztec mythology", "culture": "Aztec / Nahua", "region": "Mesoamerica"},
    {"query": "Zulu folk tales", "culture": "Zulu", "region": "Southern Africa"},
    # Broader genre queries to widen the net once narrow culture queries are
    # exhausted; culture/region falls back to per-result subject parsing.
    {"query": "fairy tales", "culture": "Traditional (unspecified)", "region": "Unspecified"},
    {"query": "folklore", "culture": "Traditional (unspecified)", "region": "Unspecified"},
    {"query": "mythology", "culture": "Traditional (unspecified)", "region": "Unspecified"},
    {"query": "legends and myths", "culture": "Traditional (unspecified)", "region": "Unspecified"},
    {"query": "folk tales", "culture": "Traditional (unspecified)", "region": "Unspecified"},
    {"query": "fables", "culture": "Traditional (unspecified)", "region": "Unspecified"},
    {"query": "nursery tales", "culture": "Traditional (unspecified)", "region": "Unspecified"},
]

COUNTRY_REGION_MAP = {
    "russia": "Eastern Europe", "japan": "East Asia", "china": "East Asia", "korea": "East Asia",
    "india": "South Asia", "persia": "Middle East", "iran": "Middle East", "egypt": "North Africa",
    "greece": "Mediterranean Europe", "germany": "Western Europe", "france": "Western Europe",
    "ireland": "British Isles", "scotland": "British Isles", "wales": "British Isles",
    "england": "British Isles", "britain": "British Isles", "norway": "Northern Europe",
    "sweden": "Northern Europe", "denmark": "Northern Europe", "iceland": "Northern Europe",
    "finland": "Northern Europe", "mexico": "Mesoamerica", "brazil": "South America",
    "hawaii": "Pacific", "australia": "Oceania", "arabia": "Middle East", "turkey": "Middle East",
    "philippines": "Southeast Asia", "vietnam": "Southeast Asia", "thailand": "Southeast Asia",
    "mongolia": "Central Asia", "tibet": "Central Asia", "poland": "Eastern Europe",
    "serbia": "Eastern Europe", "italy": "Mediterranean Europe", "spain": "Mediterranean Europe",
    "zulu": "Southern Africa", "africa": "Africa", "netherlands": "Western Europe",
}

SUBJECT_CULTURE_RE = re.compile(
    r"(?:folklore|fairy tales|tales|mythology|legends)\s*--\s*([A-Za-z][A-Za-z .'-]+)", re.I
)


def slugify(text: str, max_words: int = 8) -> str:
    s = text.lower()
    s = re.sub(r"[^a-z0-9\s]", "", s)
    words = [w for w in s.split() if w][:max_words]
    slug = "_".join(words)
    if not slug:
        slug = "tale_" + hashlib.sha1(text.encode("utf-8")).hexdigest()[:8]
    return slug


def clean_synopsis(text: str, max_chars: int = 420) -> str:
    text = re.sub(r"\(this is an automatically generated summary\.?\)", "", text, flags=re.I)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    last_period = truncated.rfind(". ")
    if last_period > 100:
        return truncated[: last_period + 1].strip()
    return truncated.rstrip() + "…"


def _http_get_json(url: str, timeout: int = 8) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, socket.timeout, TimeoutError):
        # Some sandboxed/dual-stack networks time out on IPv6 routes to hosts
        # that only answer reliably over IPv4. Retry once, IPv4-only.
        orig_getaddrinfo = socket.getaddrinfo

        def _ipv4_only(host, port, family=0, type=0, proto=0, flags=0):
            return orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)

        socket.getaddrinfo = _ipv4_only
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        finally:
            socket.getaddrinfo = orig_getaddrinfo


def _infer_culture_region(subjects: list[str], bookshelves: list[str], fallback_culture: str, fallback_region: str):
    haystack = subjects + bookshelves
    for s in haystack:
        m = SUBJECT_CULTURE_RE.search(s)
        if m:
            country = m.group(1).strip().rstrip(".")
            region = COUNTRY_REGION_MAP.get(country.lower())
            if region:
                return country, region
    return fallback_culture, fallback_region


def fetch_gutenberg_entries(per_query_limit: int = 15, query_limit: int | None = None) -> list[dict]:
    """Query Gutendex (JSON API mirroring Project Gutenberg metadata) and
    convert hits into catalog stubs. Returns [] on any network failure —
    callers should still have the curated list to fall back on."""
    entries: list[dict] = []
    seen_ids: set[str] = set()
    queries = SEARCH_QUERIES if query_limit is None else SEARCH_QUERIES[:query_limit]
    consecutive_failures = 0
    breaker_threshold = 3  # abort remaining queries after this many failures in a row
    for spec in queries:
        if consecutive_failures >= breaker_threshold:
            print(f"  [warn] {consecutive_failures} consecutive Gutendex failures — "
                  f"network looks unreachable, skipping remaining {len(queries) - queries.index(spec)} "
                  "queries and continuing with the curated list only.")
            break
        params = urllib.parse.urlencode({"search": spec["query"], "languages": "en"})
        url = f"{GUTENDEX_BASE}?{params}"
        try:
            data = _http_get_json(url)
            consecutive_failures = 0
        except Exception as exc:  # noqa: BLE001 - network is best-effort here
            consecutive_failures += 1
            print(f"  [warn] Gutendex query failed ({spec['query']!r}): {exc}")
            continue
        results = data.get("results", [])[:per_query_limit]
        for r in results:
            title = (r.get("title") or "").strip()
            if not title:
                continue
            summaries = r.get("summaries") or []
            if not summaries:
                continue  # need real synopsis text; skip bare metadata hits
            if r.get("media_type") != "Text":
                continue
            subjects = r.get("subjects") or []
            bookshelves = r.get("bookshelves") or []
            culture, region = _infer_culture_region(subjects, bookshelves, spec["culture"], spec["region"])
            slug = slugify(title)
            if slug in seen_ids:
                continue
            seen_ids.add(slug)
            formats = r.get("formats") or {}
            source_url = (
                formats.get("text/html")
                or formats.get("application/rdf+xml")
                or f"https://www.gutenberg.org/ebooks/{r.get('id')}"
            )
            authors = ", ".join(a.get("name", "") for a in (r.get("authors") or []) if a.get("name"))
            synopsis = clean_synopsis(summaries[0])
            entries.append({
                "id": slug,
                "title": title,
                "culture": culture,
                "region": region,
                "source_url": source_url,
                "synopsis": synopsis,
                "characters": [],
                "setting": f"{culture} storytelling tradition" + (f" (collected/translated by {authors})" if authors else ""),
                "math_theme_tags": [],
                "concept_affinity_scores": {},
                "math_skin_score": None,
                "enriched": False,
            })
    return entries


def _gb_search_url(query: str) -> str:
    return "https://www.gutenberg.org/ebooks/search/?" + urllib.parse.urlencode({"query": query})


def _stub(id_, title, culture, region, source_query, synopsis, characters, setting):
    return {
        "id": id_,
        "title": title,
        "culture": culture,
        "region": region,
        "source_url": _gb_search_url(source_query),
        "synopsis": synopsis,
        "characters": characters,
        "setting": setting,
        "math_theme_tags": [],
        "concept_affinity_scores": {},
        "math_skin_score": None,
        "enriched": False,
    }


def build_curated_tales() -> list[dict]:
    """~80 hand-curated public-domain folk tales for cultures thin on
    Gutendex's English catalog, with hand-written one-paragraph synopses."""
    t = []

    # --- West Africa / Akan-Ashanti (Anansi cycle) ---
    t.append(_stub("anansi_spider_wisdom", "Anansi and the Wisdom Pot", "Akan / Ashanti", "West Africa",
        "Anansi wisdom pot",
        "Anansi the spider tries to hoard all the world's wisdom in a single clay pot, climbing a tree to hide it out of everyone's reach. When the pot slips and shatters at the base of the tree, wisdom scatters across the world in pieces — which is why, the story explains, no single person holds all of it and everyone must share what they know.",
        [{"name": "Anansi", "role": "trickster spider"}, {"name": "Anansi's son", "role": "foil"}],
        "A West African forest village near a great tree"))
    t.append(_stub("anansi_moss_covered_rock", "Anansi and the Moss-Covered Rock", "Akan / Ashanti", "West Africa",
        "Anansi moss covered rock",
        "Anansi discovers a strange rock in the forest that knocks out anyone who insults its odd shape, and uses the trick to steal food from every animal who stops to rest near it. Bush Deer figures out the pattern and turns the trap back on Anansi, teaching the greedy spider a lesson about respecting what you don't understand.",
        [{"name": "Anansi", "role": "trickster spider"}, {"name": "Bush Deer", "role": "clever rival"}],
        "A forest path in the Ashanti homeland"))
    t.append(_stub("anansi_talking_melon", "Anansi and the Talking Melon", "Akan / Ashanti", "West Africa",
        "Anansi talking melon",
        "Anansi eats his way into a giant melon in the king's garden and, trapped inside, tricks the passing farmers by pretending the melon can talk and insult them. The ruse escalates until the king himself is fooled, and Anansi's greed for an easy meal turns into a public humiliation.",
        [{"name": "Anansi", "role": "trickster spider"}, {"name": "the King", "role": "authority figure"}],
        "A royal garden and marketplace"))
    t.append(_stub("anansi_and_six", "Anansi and His Six Sons", "Akan / Ashanti", "West Africa",
        "Anansi six sons",
        "When Anansi is swallowed by a great fish, his six sons — each with a different special gift — must work together to rescue him. Afterward Anansi cannot decide which son deserves a magical globe of light as a reward, so Nyame the sky god places it in the heavens instead, becoming the moon.",
        [{"name": "Anansi", "role": "trickster spider"}, {"name": "the six sons", "role": "rescuers, each with one gift"}],
        "Rivers, roads, and the sky above the Ashanti homeland"))
    t.append(_stub("anansi_sky_gods_stories", "How Anansi Brought Stories to the World", "Akan / Ashanti", "West Africa",
        "Anansi sky god stories",
        "All stories once belonged to Nyame, the sky god, until Anansi asks to buy them. Nyame sets an impossible price — capture the python, the hornets, and the leopard — and Anansi outwits all three with patience and clever bargains, winning the right to have every tale called an 'Anansi story' ever after.",
        [{"name": "Anansi", "role": "trickster spider"}, {"name": "Nyame", "role": "sky god"}],
        "The sky god's realm above the Ashanti homeland"))

    # --- Yoruba / Southern Africa / East Africa ---
    t.append(_stub("yoruba_tortoise_wisdom", "Why the Tortoise's Shell Is Not Smooth", "Yoruba", "West Africa",
        "Yoruba tortoise shell tale",
        "Tortoise convinces all the birds to lend him feathers so he can fly to a sky feast, then insults his hosts by claiming the entire feast is meant for him alone under a trick name. Furious, the birds take back their feathers mid-flight and Tortoise falls to earth, cracking his shell into the patchwork pattern it wears today.",
        [{"name": "Tortoise", "role": "trickster"}, {"name": "the birds", "role": "wronged hosts"}],
        "A Yoruba village and the sky-feast above it"))
    t.append(_stub("yoruba_hare_hyena_race", "The Hare and the Hyena's Bargain", "Yoruba", "West Africa",
        "Yoruba hare hyena tale",
        "Hare tricks the slow, greedy Hyena into a series of unfair trades, each time convincing Hyena he is getting the better deal. By the story's end, Hyena has traded away everything he owns for nothing of value, and the village elders use the tale to warn children against deals that sound too easy.",
        [{"name": "Hare", "role": "trickster"}, {"name": "Hyena", "role": "greedy mark"}],
        "A West African village marketplace"))
    t.append(_stub("zulu_unanana_bosele", "Unanana and the Elephant", "Zulu", "Southern Africa",
        "Zulu Unanana elephant tale",
        "An enormous elephant swallows the woman Unanana and her two children whole, along with an entire village of people and cattle living unharmed inside its belly. Unanana lights a fire inside the beast to force it to release everyone, freeing the swallowed village in one dramatic escape.",
        [{"name": "Unanana", "role": "resourceful mother"}, {"name": "the elephant", "role": "monstrous obstacle"}],
        "A Zulu village and the countryside beyond it"))
    t.append(_stub("ethiopian_lion_share", "The Lion's Share of the Hunt", "Ethiopian", "East Africa",
        "Ethiopian lion share fable",
        "Four animals hunt together and agree to split the kill equally, but the Lion invents one excuse after another — his strength, his mane, his hunger — to claim every portion for himself. The tale is told to children as a caution about partners who set the terms of a 'fair split' only in their own favor.",
        [{"name": "the Lion", "role": "powerful cheat"}, {"name": "the three hunting partners", "role": "wronged parties"}],
        "The savanna hunting grounds of the Horn of Africa"))

    # --- India: Panchatantra & Jataka ---
    t.append(_stub("panchatantra_lion_bull", "The Lion and the Two Bulls", "Indian (Panchatantra)", "South Asia",
        "Panchatantra lion two bulls",
        "Two bulls travel together and survive a lion's attacks only because they stand back to back, doubling their strength. A jackal, jealous of the lion's failure, whispers lies to each bull until they turn on each other and separate — and the lion picks them off one at a time, exactly as the jackal intended.",
        [{"name": "two bulls", "role": "allies"}, {"name": "the jackal", "role": "schemer"}, {"name": "the lion", "role": "predator"}],
        "A forest clearing in ancient India"))
    t.append(_stub("panchatantra_monkey_crocodile", "The Monkey and the Crocodile", "Indian (Panchatantra)", "South Asia",
        "Panchatantra monkey crocodile",
        "A crocodile befriends a monkey and, at his wife's urging, invites him across the river to steal his heart for her to eat. The monkey claims — quick-wittedly — that he left his heart back in the tree, and talks the crocodile into rowing him safely home before the trick can be discovered.",
        [{"name": "the monkey", "role": "clever prey"}, {"name": "the crocodile", "role": "gullible predator"}],
        "A riverbank between a fruit tree and a crocodile's den"))
    t.append(_stub("panchatantra_blue_jackal", "The Blue Jackal", "Indian (Panchatantra)", "South Asia",
        "Panchatantra blue jackal",
        "A jackal falls into a vat of indigo dye and emerges an unfamiliar blue color, so he convinces the forest animals he is a divine king sent to rule them. His reign of borrowed authority collapses the moment he can't resist howling with the other jackals at moonrise, revealing exactly what he really is.",
        [{"name": "the blue jackal", "role": "imposter king"}, {"name": "the forest animals", "role": "deceived subjects"}],
        "A forest and a dyer's vat on its edge"))
    t.append(_stub("jataka_monkey_king", "The Monkey King's Bridge", "Indian (Jataka Tales)", "South Asia",
        "Jataka monkey king bridge",
        "When a human king's archers threaten a troop of mango-eating monkeys trapped on a riverbank, the monkey king stretches his own body across the river as a living bridge so his troop can escape to safety. He is struck down before the last monkey crosses, and the human king, moved by the sacrifice, carries him to safety and gives him proper honors.",
        [{"name": "the Monkey King", "role": "self-sacrificing leader"}, {"name": "the human king", "role": "witness, later ally"}],
        "A river gorge beneath a mango tree"))
    t.append(_stub("jataka_golden_goose", "The Goose With the Golden Feathers", "Indian (Jataka Tales)", "South Asia",
        "Jataka golden goose",
        "A magical goose visits his former wife's poor family and gives them one golden feather at a time to lift them out of poverty. Impatient, the wife eventually plucks every feather from him at once, only to find the stolen feathers turn to ordinary white ones — the goose's gift only worked given freely, one at a time.",
        [{"name": "the golden goose", "role": "generous giver"}, {"name": "the wife", "role": "impatient taker"}],
        "A poor household and the pond the goose visits"))

    # --- Persian ---
    t.append(_stub("shahnameh_rustam_sohrab", "Rustam and Sohrab", "Persian", "Middle East",
        "Shahnameh Rustam Sohrab",
        "The legendary hero Rustam unknowingly duels his own son Sohrab, whom he has never met, on a battlefield between two warring kingdoms. Only after landing the fatal blow does Rustam recognize the armband he himself once left with Sohrab's mother, turning a war story into one of the great tragic recognitions of the Persian epic Shahnameh.",
        [{"name": "Rustam", "role": "legendary hero"}, {"name": "Sohrab", "role": "his unknown son"}],
        "A battlefield between the Persian and Turanian armies"))
    t.append(_stub("persian_forty_thieves", "The Forty Thieves", "Persian / Arabian", "Middle East",
        "Ali Baba forty thieves",
        "A poor woodcutter, Ali Baba, overhears the password 'Open Sesame' and discovers a robber band's hidden treasure cave. When the thieves track him down, it is his quick-thinking servant Morgiana who foils their plot at every turn, using clever misdirection to save the household.",
        [{"name": "Ali Baba", "role": "poor woodcutter"}, {"name": "Morgiana", "role": "clever servant"}, {"name": "the forty thieves", "role": "antagonists"}],
        "A Persian town and the hidden cave in the hills nearby"))
    t.append(_stub("persian_simurgh_zal", "The Simurgh and Zal", "Persian", "Middle East",
        "Shahnameh Simurgh Zal",
        "An infant born with pale white hair is abandoned on a mountainside for looking unlike other children, and is raised instead by the wise, magical bird Simurgh. Grown to manhood as the hero Zal, he is eventually reunited with his royal father and given one of the Simurgh's own feathers to summon her aid in times of need.",
        [{"name": "Zal", "role": "abandoned prince"}, {"name": "the Simurgh", "role": "wise magical bird"}],
        "A mountain nest and the Persian royal court"))
    t.append(_stub("persian_sindbad_voyages", "Sindbad's Seven Voyages", "Arabian / Persian", "Middle East",
        "Sindbad seven voyages",
        "A merchant of Baghdad recounts seven increasingly fantastical sea voyages — an island that turns out to be a sleeping whale, a valley of diamonds guarded by serpents, a roc's egg the size of a dome — each disaster teaching him to weigh risk and reward before setting sail again.",
        [{"name": "Sindbad", "role": "merchant-adventurer"}],
        "The docks of Baghdad and the seas beyond"))

    # --- Chinese, Japanese, Korean, Southeast/Central Asian ---
    t.append(_stub("chinese_monkey_king", "The Monkey King's Journey", "Chinese", "East Asia",
        "Journey to the West Monkey King",
        "Born from a stone egg on a mountain, the Monkey King Sun Wukong masters magic, steals the Jade Emperor's peaches of immortality, and is imprisoned under a mountain by the Buddha for his pride. Centuries later he is freed to escort a monk on a pilgrimage west, using his powers to protect the group from ambushing demons along the way.",
        [{"name": "Sun Wukong", "role": "trickster hero"}, {"name": "the monk Xuanzang", "role": "pilgrim he protects"}],
        "Mountains, heaven's court, and the road west across China"))
    t.append(_stub("chinese_cowherd_weaver", "The Cowherd and the Weaver Girl", "Chinese", "East Asia",
        "Cowherd and Weaver Girl legend",
        "A mortal cowherd falls in love with a weaving goddess who has come down to bathe among mortals, and the two marry and raise a family in secret. When the heavens discover the match, the goddess is dragged back to the sky and a river of stars is drawn between them — the two are allowed to reunite for one night each year, when magpies form a bridge across the Milky Way.",
        [{"name": "the cowherd", "role": "mortal husband"}, {"name": "the weaver girl", "role": "star goddess"}],
        "A mortal farm and the night sky above it"))
    t.append(_stub("chinese_nian_beast", "The Nian Beast and the New Year", "Chinese", "East Asia",
        "Nian beast new year legend",
        "Each new year, a monstrous beast called Nian descends on a village to devour livestock and children, until an old beggar discovers the creature fears loud noise, fire, and the color red. The villagers drive Nian away with firecrackers and red banners, founding the customs still used to welcome the new year today.",
        [{"name": "the Nian beast", "role": "seasonal monster"}, {"name": "the old beggar", "role": "clever outsider"}],
        "A Chinese village on the eve of the new year"))
    t.append(_stub("japanese_momotaro", "Momotaro, the Peach Boy", "Japanese", "East Asia",
        "Momotaro peach boy",
        "An elderly, childless couple find a giant peach floating down the river, and inside it discover a boy sent to them by heaven. Grown to youth, Momotaro sets off with a dog, a monkey, and a pheasant — each recruited with a single millet dumpling — to defeat the demons terrorizing a nearby island and bring home their stolen treasure.",
        [{"name": "Momotaro", "role": "heaven-sent hero"}, {"name": "the dog, monkey, and pheasant", "role": "recruited allies"}],
        "A riverside village and Demon Island offshore"))
    t.append(_stub("japanese_bamboo_cutter", "The Tale of the Bamboo Cutter", "Japanese", "East Asia",
        "Bamboo cutter Kaguya-hime",
        "A bamboo cutter finds a tiny glowing girl inside a stalk of bamboo and raises her as his own; she grows into a radiant woman, Kaguya-hime, who refuses every suitor with impossible tasks. In the end she reveals she is from the Moon and must return, leaving her earthly family an elixir of immortality they choose not to drink out of grief.",
        [{"name": "Kaguya-hime", "role": "moon princess"}, {"name": "the bamboo cutter", "role": "adoptive father"}],
        "A bamboo grove and the imperial court of old Japan"))
    t.append(_stub("japanese_urashima_taro", "Urashima Taro and the Dragon Palace", "Japanese", "East Asia",
        "Urashima Taro dragon palace",
        "A fisherman rescues a small turtle and is rewarded with a visit to the Dragon Palace beneath the sea, where he spends what feels like three pleasant days. Returning home with a forbidden box he is told never to open, he finds three hundred years have passed — and opening the box against warning ages him instantly into an old man.",
        [{"name": "Urashima Taro", "role": "fisherman"}, {"name": "the Dragon Princess", "role": "undersea host"}],
        "A fishing village and the palace beneath the sea"))
    t.append(_stub("korean_heavenly_maiden", "The Woodcutter and the Heavenly Maiden", "Korean", "East Asia",
        "Korean heavenly maiden woodcutter",
        "A kind woodcutter, helped by a deer he once saved, hides the wings of a bathing heavenly maiden so she cannot fly back to the sky, and the two marry and have children. Years later she recovers her wings and returns to heaven with the children, and the woodcutter must earn a place beside her by completing tasks set by her celestial family.",
        [{"name": "the woodcutter", "role": "earnest suitor"}, {"name": "the heavenly maiden", "role": "sky being"}],
        "A mountain forest and the sky realm above it"))
    t.append(_stub("korean_heungbu_nolbu", "Heungbu and Nolbu", "Korean", "East Asia",
        "Korean Heungbu Nolbu swallow",
        "Of two brothers, generous Heungbu nurses an injured swallow back to health and is rewarded with a seed that grows gourds full of treasure. His greedy brother Nolbu deliberately breaks a swallow's leg to force the same reward, but his gourds burst open with goblins and disaster instead — a lesson about kindness that can't be faked for profit.",
        [{"name": "Heungbu", "role": "kind younger brother"}, {"name": "Nolbu", "role": "greedy older brother"}],
        "A Korean village and the brothers' neighboring homes"))
    t.append(_stub("vietnamese_tam_cam", "Tam and Cam", "Vietnamese", "Southeast Asia",
        "Vietnamese Tam Cam tale",
        "A kind orphan girl, Tam, is mistreated by her stepmother and stepsister Cam, who steal every reward she earns, including a magic fish and a golden slipper meant for the king. Through a series of magical transformations, Tam repeatedly returns to reclaim her rightful place, until fairness finally outlasts every trick used against her.",
        [{"name": "Tam", "role": "wronged stepdaughter"}, {"name": "Cam", "role": "jealous stepsister"}],
        "A Vietnamese village, a pond, and the royal court"))
    t.append(_stub("thai_manohra_kinnari", "Manohra the Kinnari Princess", "Thai", "Southeast Asia",
        "Thai Manohra Kinnari",
        "A half-bird, half-woman Kinnari princess named Manohra is captured while bathing in a forest pool and brought to marry a human prince. When court intrigue nearly costs her life, she reclaims her feathered garment and flies home to her kingdom, and the prince must undertake a long journey of trials to win her back.",
        [{"name": "Manohra", "role": "Kinnari princess"}, {"name": "Prince Suthon", "role": "human suitor"}],
        "A forest pool and the Kinnari kingdom beyond the mountains"))
    t.append(_stub("mongolian_geser_khan", "Geser Khan and the Demon Kings", "Mongolian", "Central Asia",
        "Mongolian Geser Khan epic",
        "Sent down from heaven to rid the earth of tyranny, the hero Geser Khan is born to a poor family and grows up disguised as an unremarkable, even foolish boy before revealing his true strength. He goes on to defeat a succession of demon kings threatening different kingdoms, using cunning as often as force.",
        [{"name": "Geser Khan", "role": "heaven-sent hero"}, {"name": "the demon kings", "role": "recurring antagonists"}],
        "The steppes and kingdoms of the Mongolian epic tradition"))
    t.append(_stub("tibetan_monkey_ogress", "The Monkey and the Ogress", "Tibetan", "Central Asia",
        "Tibetan monkey ogress origin tale",
        "A meditating monkey is seduced by a mountain ogress who threatens to turn to violence and destroy all life in the valley if he refuses to marry her. Their union produces six children, ancestors of the Tibetan people, each inheriting a mix of the monkey's patience and the ogress's fierce will.",
        [{"name": "the monkey", "role": "reluctant ancestor"}, {"name": "the ogress", "role": "fierce suitor"}],
        "A mountain valley in the Tibetan plateau"))
    t.append(_stub("filipino_sun_moon", "Why the Sun and Moon Live in the Sky", "Filipino", "Southeast Asia",
        "Filipino sun moon legend",
        "The sun and moon were once married and lived together on earth, quarreling over how to raise their many star children. After a fight over one of their children being devoured, the moon flees into the sky and the sun chases her there too, and the two have lived apart in the heavens — one by day, one by night — ever since.",
        [{"name": "the Sun", "role": "estranged husband"}, {"name": "the Moon", "role": "estranged wife"}],
        "Early earth, before the sky was settled"))

    # --- Norse / Celtic / Finnish / Germanic / Slavic ---
    t.append(_stub("norse_thor_hammer", "Thor's Stolen Hammer", "Norse / Scandinavian", "Northern Europe",
        "Norse Thor hammer theft",
        "The giant Thrym steals Thor's hammer Mjolnir and demands the goddess Freya as ransom for its return. Thor disguises himself as a bride in Freya's place, and when the hammer is laid in his lap as part of the wedding blessing, he seizes it back and destroys every giant in the hall.",
        [{"name": "Thor", "role": "god of thunder"}, {"name": "Thrym", "role": "giant thief"}, {"name": "Loki", "role": "scheming helper"}],
        "The realm of the giants, Jotunheim"))
    t.append(_stub("norse_mimirs_well", "Odin at Mimir's Well", "Norse / Scandinavian", "Northern Europe",
        "Odin Mimir's well myth",
        "Seeking the wisdom hidden in the well beneath the world tree, Odin asks the guardian Mimir for a single drink. Mimir demands one of Odin's eyes as payment, and Odin accepts without hesitation, trading half his sight forever for a wisdom no other god possesses.",
        [{"name": "Odin", "role": "chief god"}, {"name": "Mimir", "role": "well's guardian"}],
        "The roots of Yggdrasil, the world tree"))
    t.append(_stub("norse_fenrir_binding", "The Binding of Fenrir", "Norse / Scandinavian", "Northern Europe",
        "Norse Fenrir binding myth",
        "The gods, fearing the growing wolf Fenrir, commission dwarves to forge an unbreakable ribbon from impossible ingredients — the sound of a cat's footsteps, a woman's beard, a mountain's roots. Fenrir agrees to be bound only if a god places a hand in his mouth as proof of no trickery, and Tyr alone volunteers, losing his hand when the binding proves true.",
        [{"name": "Fenrir", "role": "monstrous wolf"}, {"name": "Tyr", "role": "god who sacrifices his hand"}],
        "Asgard and the realm of the gods"))
    t.append(_stub("celtic_children_of_lir", "The Children of Lir", "Irish (Celtic)", "British Isles",
        "Children of Lir legend",
        "A jealous stepmother transforms her husband's four children into swans, cursing them to spend nine hundred years on lakes and seas before they can become human again. They keep their human voices and singing throughout the long enchantment, until the ringing of a new religion's bell finally breaks the spell — too late for them to live long as humans again.",
        [{"name": "the four children", "role": "cursed swans"}, {"name": "Aoife", "role": "jealous stepmother"}],
        "Irish lakes and coastlines across nine centuries"))
    t.append(_stub("celtic_salmon_of_knowledge", "The Salmon of Knowledge", "Irish (Celtic)", "British Isles",
        "Salmon of knowledge Fionn",
        "A poet spends years fishing for the legendary Salmon of Knowledge, which holds all the world's wisdom in its flesh. When his young servant Fionn accidentally burns his thumb cooking the fish and sucks it to cool the pain, the boy — not the poet — receives all the salmon's wisdom instead.",
        [{"name": "Fionn mac Cumhaill", "role": "young servant"}, {"name": "Finn Eces", "role": "the poet"}],
        "A riverbank in ancient Ireland"))
    t.append(_stub("celtic_selkie_wife", "The Selkie Wife", "Scottish (Celtic)", "British Isles",
        "Selkie wife folktale",
        "A fisherman steals and hides the sealskin of a selkie woman so she cannot return to the sea, and she stays to become his wife and raise his children on land. Years later one of her own children finds the hidden skin and returns it to her, and she slips back into the ocean, unable to resist the pull of her true form.",
        [{"name": "the selkie", "role": "sea-woman bound to land"}, {"name": "the fisherman", "role": "husband who hid her skin"}],
        "A Scottish fishing village on the coast"))
    t.append(_stub("welsh_mabinogion_rhiannon", "Rhiannon and the Horse", "Welsh (Celtic)", "British Isles",
        "Mabinogion Rhiannon horse",
        "A mysterious rider on an uncatchable horse turns out to be Rhiannon, a woman of the Otherworld who chooses Prince Pwyll for her husband over an unwanted suitor. Later falsely accused of killing her own infant son, she is forced to carry visitors on her back like a beast for years until the truth of the boy's survival is finally uncovered.",
        [{"name": "Rhiannon", "role": "Otherworldly bride"}, {"name": "Pwyll", "role": "her husband"}],
        "The kingdom of Dyfed in the Mabinogion's Wales"))
    t.append(_stub("finnish_sampo_forging", "The Forging of the Sampo", "Finnish", "Northern Europe",
        "Kalevala Sampo forging",
        "The smith Ilmarinen forges a magical mill called the Sampo that grinds out endless grain, salt, and gold, as payment to win the Maiden of the North. When the bargain sours, the heroes of the Kalevala sail north to steal the Sampo back, and it shatters into the sea during the getaway, scattering its fragments to bless the world's shores.",
        [{"name": "Ilmarinen", "role": "master smith"}, {"name": "Väinämöinen", "role": "wise hero"}],
        "The northern land of Pohjola in the Finnish Kalevala"))
    t.append(_stub("german_bremen_musicians", "The Bremen Town Musicians", "German", "Western Europe",
        "Grimm Bremen town musicians",
        "Four aging farm animals, each cast off by masters who no longer find them useful, set out together to become musicians in the town of Bremen. Along the way they stumble on a robbers' cottage and, standing stacked atop one another braying and howling through the window, scare the robbers off and claim the house as their own.",
        [{"name": "the donkey", "role": "leader"}, {"name": "the dog, cat, and rooster", "role": "fellow travelers"}],
        "A country road leading toward Bremen"))
    t.append(_stub("german_hansel_gretel", "Hansel and Gretel", "German", "Western Europe",
        "Grimm Hansel Gretel",
        "Abandoned in the forest by parents too poor to feed them, siblings Hansel and Gretel stumble on a house made of candy and bread that belongs to a child-eating witch. Gretel outsmarts the witch by shoving her into her own oven, and the children escape home with the witch's hoarded treasure.",
        [{"name": "Hansel", "role": "brother"}, {"name": "Gretel", "role": "sister, ultimate rescuer"}, {"name": "the witch", "role": "antagonist"}],
        "A dark forest and a candy house within it"))
    t.append(_stub("russian_baba_yaga", "Vasilisa and Baba Yaga", "Russian / Slavic", "Eastern Europe",
        "Vasilisa Baba Yaga tale",
        "A cruel stepmother sends young Vasilisa into the forest to borrow fire from the witch Baba Yaga, hoping she never returns. Guided by a magical doll her late mother gave her, Vasilisa completes Baba Yaga's impossible household tasks and returns home with a skull lantern whose fiery eyes burn her stepfamily to ash.",
        [{"name": "Vasilisa", "role": "resourceful stepdaughter"}, {"name": "Baba Yaga", "role": "witch of the forest"}],
        "A Russian village and the witch's hut deep in the forest"))
    t.append(_stub("russian_firebird", "The Firebird", "Russian / Slavic", "Eastern Europe",
        "Russian Firebird tale",
        "A prince tracks a glowing Firebird that has been stealing golden apples from his father's orchard, and his quest to capture it draws him into a series of trials involving a gray wolf, a princess, and a rival prince's betrayal. The wolf's magical aid repeatedly saves him, teaching the value of loyalty over the shortcuts his brothers try instead.",
        [{"name": "Prince Ivan", "role": "youngest prince"}, {"name": "the Gray Wolf", "role": "magical helper"}, {"name": "the Firebird", "role": "quest object"}],
        "A royal orchard and the lands beyond it"))
    t.append(_stub("polish_twardowski_moon", "Pan Twardowski on the Moon", "Polish / Slavic", "Eastern Europe",
        "Polish Twardowski moon legend",
        "A sorcerer named Twardowski signs a pact with the devil for magical power, on the condition the devil may only claim him in Rome. Twardowski avoids Rome for the rest of his life — until he is lured into an inn by that very name, and the devil sweeps him up to live out eternity stranded on the moon instead of hell.",
        [{"name": "Pan Twardowski", "role": "clever sorcerer"}, {"name": "the devil", "role": "bound antagonist"}],
        "Kraków and, eventually, the surface of the moon"))

    # --- Native American / Inuit ---
    t.append(_stub("iroquois_sky_woman", "Sky Woman and the Great Turtle", "Iroquois (Haudenosaunee)", "North America",
        "Iroquois Sky Woman creation",
        "A woman falls from a hole torn in the sky world and is caught by geese, who set her gently on the back of a great turtle floating in a boundless sea. Animals dive again and again to bring up mud from the ocean floor until enough is gathered to spread across the turtle's shell, forming the land the Iroquois call Turtle Island.",
        [{"name": "Sky Woman", "role": "world's first mother"}, {"name": "the animals", "role": "cooperative helpers"}],
        "A boundless primordial sea before the land existed"))
    t.append(_stub("navajo_spider_woman", "Spider Woman Teaches Weaving", "Navajo (Diné)", "North America",
        "Navajo Spider Woman weaving",
        "Spider Woman teaches the first Navajo women how to weave on a loom built from sky, earth, sun rays, and lightning, passing down both the craft and the discipline required to master it. Spider Man builds the actual loom, but it is Spider Woman's patient instruction that turns raw wool into patterns that carry meaning.",
        [{"name": "Spider Woman", "role": "teacher of weaving"}, {"name": "Spider Man", "role": "loom-builder"}],
        "The Navajo homeland in the American Southwest"))
    t.append(_stub("cherokee_first_fire", "How the Animals Brought Fire", "Cherokee", "North America",
        "Cherokee first fire legend",
        "After lightning strikes a hollow sycamore and traps fire inside, every large animal that tries to retrieve it is burned or scared off in turn. It is the small, unassuming Water Spider who finally succeeds, weaving a tiny bowl from her own web to carry a single coal safely back across the water to the other animals.",
        [{"name": "Water Spider", "role": "unlikely hero"}, {"name": "the larger animals", "role": "failed attempts"}],
        "A swamp with a lightning-struck sycamore at its center"))
    t.append(_stub("lakota_iktomi_trickster", "Iktomi and the Ducks", "Lakota", "North America",
        "Lakota Iktomi ducks tale",
        "The trickster Iktomi convinces a flock of ducks to dance with their eyes shut so he can secretly grab and cook them one by one for a feast. One duck peeks, sees the trick, and warns the others in time — leaving Iktomi with an empty pot and a lesson about greed outrunning cleverness.",
        [{"name": "Iktomi", "role": "trickster spider-man"}, {"name": "the ducks", "role": "nearly-tricked prey"}],
        "A prairie lake on the Great Plains"))
    t.append(_stub("anishinaabe_wenabozho_maple", "Wenabozho and the Maple Trees", "Anishinaabe (Ojibwe)", "North America",
        "Anishinaabe Wenabozho maple syrup",
        "In the old days maple trees dripped pure, thick syrup year-round, so people grew lazy and stopped working, gathering, or planting. Wenabozho pours water into the treetops to thin the syrup and make it flow only briefly each spring after hard boiling, restoring balance by making the sweetness require real effort to earn.",
        [{"name": "Wenabozho", "role": "culture hero and trickster"}],
        "Maple forests of the northern Great Lakes"))
    t.append(_stub("hopi_spider_grandmother", "Spider Grandmother and the Twins", "Hopi", "North America",
        "Hopi Spider Grandmother twins",
        "Spider Grandmother guides the Hero Twins on a dangerous journey to visit their father, the Sun, teaching them songs and charms to survive trials set by hostile spirits along the way. Her small size belies her power — she rides hidden behind a twin's ear, whispering exactly the right words at exactly the right moment.",
        [{"name": "Spider Grandmother", "role": "wise guide"}, {"name": "the Hero Twins", "role": "questing sons"}],
        "The mesas of the Hopi homeland and the road to the Sun's house"))
    t.append(_stub("inuit_sedna_sea", "Sedna, Mother of the Sea", "Inuit", "Arctic North America",
        "Inuit Sedna sea goddess origin",
        "A young woman named Sedna is thrown from a boat by her own father during a storm, and as she clings to the side, he cuts off her fingers one by one to make her let go. Her severed fingers become the seals, whales, and walruses of the ocean, and Sedna sinks to the sea floor to become its ruling spirit, who must be appeased before a good hunt.",
        [{"name": "Sedna", "role": "sea goddess"}, {"name": "her father", "role": "betrayer"}],
        "The Arctic sea and a kayak caught in a storm"))
    t.append(_stub("inuit_raven_light", "Raven Steals the Light", "Inuit / Pacific Northwest", "Arctic North America",
        "Raven steals the light legend",
        "In a world kept in total darkness by a selfish old chief who hoards daylight in a series of nested boxes, Raven transforms himself into a pine needle to be swallowed and reborn as the chief's own grandson. Trusted and beloved in his new form, the boy-Raven talks his way into playing with the boxes of light and escapes through the smoke hole with the sun, moon, and stars, scattering them across the sky for everyone.",
        [{"name": "Raven", "role": "shape-shifting trickster"}, {"name": "the old chief", "role": "hoarder of light"}],
        "A world of total darkness before the sky held light"))

    # --- Mesoamerica / South America / Caribbean ---
    t.append(_stub("aztec_five_suns", "The Legend of the Five Suns", "Aztec / Nahua", "Mesoamerica",
        "Aztec five suns creation myth",
        "The Aztec world has been destroyed and remade four times already, each age ended by a different catastrophe — jaguars, wind, fire, flood — under a different sun god who failed to sustain it. To create the fifth and current sun, two gods must throw themselves into a sacred fire, and the sun that rises afterward will only move across the sky once it is fed with the blood of sacrifice.",
        [{"name": "Nanahuatzin", "role": "humble god who becomes the sun"}, {"name": "Tecuciztecatl", "role": "prideful rival god"}],
        "The gods' gathering place at Teotihuacan"))
    t.append(_stub("aztec_quetzalcoatl_maize", "Quetzalcoatl Brings Maize to Humanity", "Aztec / Nahua", "Mesoamerica",
        "Quetzalcoatl maize legend",
        "Humanity survives only on roots and game until the feathered serpent god Quetzalcoatl learns that ants have hidden a mountain of maize inside a rock. He transforms into a black ant, sneaks past the guards, and carries a single kernel back to the gods, who use it to teach people how to farm.",
        [{"name": "Quetzalcoatl", "role": "feathered serpent god"}, {"name": "the red ants", "role": "hoarders of maize"}],
        "The mountain of sustenance, Tonacatepetl"))
    t.append(_stub("maya_hero_twins_ballgame", "The Hero Twins and the Lords of Death", "Maya (Popol Vuh)", "Mesoamerica",
        "Popol Vuh hero twins ballgame",
        "Twin brothers Hunahpu and Xbalanque are summoned to the underworld of Xibalba by its death-lords to play a rigged ballgame, following in the footsteps of their father, who was killed the same way. Through cunning and trickery — outwitting biting bats, deadly houses, and false fires — the twins survive every trial and defeat death itself, ascending afterward to become the sun and the moon.",
        [{"name": "Hunahpu", "role": "hero twin"}, {"name": "Xbalanque", "role": "hero twin"}, {"name": "the Lords of Xibalba", "role": "death gods"}],
        "The Maya underworld, Xibalba"))
    t.append(_stub("maya_corn_people", "The Making of the Corn People", "Maya (Popol Vuh)", "Mesoamerica",
        "Popol Vuh corn people creation",
        "The gods attempt to create humans several times — first from mud, which dissolves, then from wood, which lacks feeling and is destroyed in a flood — before finally succeeding by grinding yellow and white corn into the flesh of the first true people. It is corn, not mud or wood, that gives humanity the right balance of strength and gratitude the gods were looking for.",
        [{"name": "the creator gods", "role": "makers of humanity"}, {"name": "the wood people", "role": "failed earlier attempt"}],
        "The dawn of the world in the Popol Vuh"))
    t.append(_stub("brazilian_curupira", "Curupira, Guardian of the Forest", "Brazilian (Tupi)", "South America",
        "Brazilian Curupira forest guardian",
        "Curupira is a small forest spirit with backward-facing feet, so that any hunter who tries to track him ends up following the footprints the wrong way, deeper into the woods rather than out. He punishes those who hunt more than they need or set the forest on fire, but is said to reward respectful hunters by leading real game their way.",
        [{"name": "Curupira", "role": "forest guardian spirit"}], "The Amazon and Atlantic forests of Brazil"))
    t.append(_stub("brazilian_boitata", "Boi-tatá, the Fire Serpent", "Brazilian (Tupi)", "South America",
        "Brazilian Boitata fire serpent",
        "After a great flood kills most animals, a lone serpent survives by eating the glowing eyes of the dead in the darkness, growing so bright with each meal that fire begins to pour from its own body. Boi-tatá becomes a wandering flame that burns down brush fires set carelessly by farmers, protecting the forest by consuming the very thing that threatens it.",
        [{"name": "Boi-tatá", "role": "fire serpent"}], "The wetlands and forests of Brazil after the great flood"))
    t.append(_stub("caribbean_anansi_tar_baby", "Anansi and the Tar-Baby", "Caribbean (Akan diaspora)", "Caribbean",
        "Caribbean Anansi tar baby",
        "A farmer sets a sticky doll made of tar in his garden to catch the thief who has been stealing his crops, and Anansi, furious when the silent 'stranger' won't answer his greetings, punches and kicks it until he's hopelessly stuck. Caught red-handed, Anansi must talk his way out of punishment using the same cleverness that got him into the mess.",
        [{"name": "Anansi", "role": "trickster spider"}, {"name": "the farmer", "role": "trap-setter"}],
        "A Caribbean garden plot, transplanted from West African tradition"))
    t.append(_stub("guarani_yerba_mate_origin", "The Gift of Yerba Mate", "Guaraní", "South America",
        "Guarani yerba mate origin legend",
        "The moon and a cloud spirit disguise themselves as young girls to walk among mortals and are nearly killed by a jaguar in the forest, saved only by a kind old hunter. In gratitude, they gift the old man a new plant grown from the sky — yerba mate — teaching his family how to prepare and share it as a drink of hospitality.",
        [{"name": "the old hunter", "role": "kind rescuer"}, {"name": "the Moon and Cloud", "role": "disguised sky spirits"}],
        "A forest village in the Guaraní homeland"))

    # --- Pacific / Oceania ---
    t.append(_stub("hawaiian_maui_sun", "Maui Snares the Sun", "Hawaiian (Polynesian)", "Pacific",
        "Maui snares the sun legend",
        "The demigod Maui's mother complains that the sun crosses the sky too fast for her tapa cloth to dry, so Maui braids ropes from his sister's hair and climbs to the sun's rising point to lasso it. He beats the sun until it agrees to move more slowly across the sky, giving the islands their long, usable daylight hours.",
        [{"name": "Maui", "role": "demigod trickster-hero"}, {"name": "the Sun", "role": "captured force of nature"}],
        "The volcanic peak of Haleakalā"))
    t.append(_stub("hawaiian_maui_fire", "Maui Steals the Secret of Fire", "Hawaiian (Polynesian)", "Pacific",
        "Maui fire secret legend",
        "When Maui notices smoke rising from the hills each night but never sees a fire, he tricks the mud hens who guard the secret of fire-making into revealing it, extinguishing every fire in the village first so they have no choice. The last hen, cornered, teaches him to rub certain woods together, and Maui shares the discovery with all of humanity.",
        [{"name": "Maui", "role": "demigod trickster-hero"}, {"name": "the mud hens", "role": "secret-keepers"}],
        "Hawaiian hillsides where the mud hens nested"))
    t.append(_stub("maori_maui_fishhook", "Maui Fishes Up the Islands", "Māori (Polynesian)", "Pacific",
        "Maui fishes up New Zealand",
        "Stowing away in his brothers' canoe, Maui casts a magical fishhook made from his grandmother's jawbone deep into the ocean and hauls up an enormous fish so large it becomes the North Island of New Zealand. His brothers, disobeying his instructions to wait for a priest's blessing, hack at the fish's flesh immediately, carving the mountains and valleys that shape the land today.",
        [{"name": "Maui", "role": "demigod trickster-hero"}, {"name": "Maui's brothers", "role": "impatient crew"}],
        "The open Pacific and the fish that becomes New Zealand"))
    t.append(_stub("aboriginal_rainbow_serpent", "The Rainbow Serpent Shapes the Land", "Aboriginal Australian", "Oceania",
        "Aboriginal Rainbow Serpent creation",
        "In the Dreaming, before the land had rivers or mountains, the great Rainbow Serpent moves across a flat, sleeping earth, her huge body carving out valleys and riverbeds as she travels toward water. Where she rests, waterholes remain today, and where she pushed up the ground, mountain ranges rose — the ancestral map of the country itself.",
        [{"name": "the Rainbow Serpent", "role": "ancestral creator being"}],
        "The Australian landscape during the Dreaming"))
    t.append(_stub("aboriginal_tiddalik_frog", "Tiddalik the Thirsty Frog", "Aboriginal Australian", "Oceania",
        "Aboriginal Tiddalik frog drought legend",
        "A giant frog named Tiddalik wakes up one morning and drinks every drop of fresh water in the world, leaving every other animal to face a terrible drought. The other animals finally succeed where force failed — they make Tiddalik laugh with a ridiculous dance, and all the water floods back out, refilling the rivers and waterholes.",
        [{"name": "Tiddalik", "role": "giant water-hoarding frog"}, {"name": "the other animals", "role": "drought survivors"}],
        "The dried-out waterholes of the Australian bush"))
    t.append(_stub("samoan_sina_eel", "Sina and the Eel", "Samoan (Polynesian)", "Pacific",
        "Samoan Sina eel coconut origin",
        "A girl named Sina raises a pet eel that grows enormous and begins pursuing her with unwanted affection, chasing her from pool to pool across the islands. Cornered at last, the eel asks to be killed and its head buried, promising that a tree will grow from the spot bearing fruit with two eyes and a mouth so she may kiss it whenever she chooses — the first coconut.",
        [{"name": "Sina", "role": "pursued girl"}, {"name": "the eel", "role": "transformed suitor"}],
        "Freshwater pools across the Samoan islands"))

    # --- Middle East / North Africa / Jewish ---
    t.append(_stub("egyptian_osiris_isis", "Osiris, Isis, and the Search for the Body", "Egyptian", "North Africa",
        "Egyptian Osiris Isis myth",
        "The god-king Osiris is murdered and dismembered by his jealous brother Set, who scatters the pieces across Egypt to prevent any resurrection. His wife Isis searches the length of the land to recover every piece, reassembles him with powerful magic, and conceives their son Horus, who will grow up to reclaim the throne from Set.",
        [{"name": "Isis", "role": "devoted wife and magician"}, {"name": "Osiris", "role": "murdered king"}, {"name": "Set", "role": "jealous brother"}],
        "The Nile valley of ancient Egypt"))
    t.append(_stub("egyptian_ra_sun_barge", "Ra's Nightly Battle in the Underworld", "Egyptian", "North Africa",
        "Egyptian Ra sun barge Apophis",
        "Each night the sun god Ra sails his barge through the underworld, and each night the chaos serpent Apophis attacks, trying to swallow the sun before dawn. Ra's crew of protective gods fights the serpent back every single night, so that the sun can rise again the next morning — a battle that never permanently ends, only pauses until dusk.",
        [{"name": "Ra", "role": "sun god"}, {"name": "Apophis", "role": "chaos serpent"}],
        "The underworld duat, traveled nightly by the sun barge"))
    t.append(_stub("jewish_golem_prague", "The Golem of Prague", "Jewish (Ashkenazi)", "Middle East / Diaspora",
        "Golem of Prague legend",
        "To protect the Jewish community of Prague from a wave of violent accusations, Rabbi Loew shapes a giant figure from river clay and brings it to life with sacred Hebrew letters placed in its mouth. The golem defends the community faithfully, but grows dangerously powerful, and the rabbi must remove the letters to still it before it turns destructive.",
        [{"name": "Rabbi Loew", "role": "creator"}, {"name": "the Golem", "role": "clay protector"}],
        "The Jewish quarter of 16th-century Prague"))
    t.append(_stub("jewish_wise_men_chelm", "The Wise Men of Chelm", "Jewish (Ashkenazi)", "Middle East / Diaspora",
        "Wise Men of Chelm folktales",
        "The town council of Chelm, famous for being comically foolish while believing themselves brilliant, solve every practical problem with elaborate, backward logic — carrying a bench up a hill so no one has to walk down for it, for instance. Each tale is a small parable about mistaking effort and confidence for actual wisdom.",
        [{"name": "the council elders", "role": "well-meaning fools"}],
        "The town of Chelm, Eastern Europe"))
    t.append(_stub("turkish_nasreddin_hodja", "The Wit of Nasreddin Hodja", "Turkish", "Middle East",
        "Nasreddin Hodja folktales",
        "Nasreddin Hodja, a village judge and teacher, resolves village disputes and confounds neighbors with jokes that are also small lessons — arguing both sides of a case are right, or insisting he lost his ring in a lit spot rather than the dark alley where it fell because 'the light is better here.' Each tale turns ordinary logic upside down to reveal an everyday truth.",
        [{"name": "Nasreddin Hodja", "role": "wise fool"}],
        "An Anatolian village and its marketplace"))

    # --- Mediterranean / Western Europe (non-Grimm) ---
    t.append(_stub("greek_atalanta_race", "Atalanta's Race", "Greek", "Mediterranean Europe",
        "Greek Atalanta golden apples race",
        "Atalanta, the fastest runner in Greece, agrees to marry only a man who can outrun her, and every loser is put to death. Her suitor Hippomenes wins by dropping three golden apples from Aphrodite one at a time during the race, and Atalanta, unable to resist stopping to pick each one up, loses by a hair.",
        [{"name": "Atalanta", "role": "fastest runner"}, {"name": "Hippomenes", "role": "clever suitor"}],
        "A footrace track in ancient Greece"))
    t.append(_stub("greek_daedalus_icarus", "Daedalus and Icarus", "Greek", "Mediterranean Europe",
        "Greek Daedalus Icarus wings myth",
        "Trapped on Crete by King Minos, the inventor Daedalus builds wings of feathers and wax for himself and his son Icarus to escape by flying over the sea. Icarus, thrilled by flight, ignores his father's warning and climbs too close to the sun; the wax melts, and he falls into the sea below.",
        [{"name": "Daedalus", "role": "master inventor"}, {"name": "Icarus", "role": "his son"}],
        "The island of Crete and the sea beyond it"))
    t.append(_stub("italian_pinocchio_origin", "Pinocchio, the Wooden Puppet", "Italian", "Mediterranean Europe",
        "Italian Pinocchio wooden puppet tale",
        "A lonely woodcarver named Geppetto carves a puppet that magically comes to life, but the boy Pinocchio must learn honesty and responsibility the hard way — his nose grows with every lie, and he is repeatedly lured away from school by tricksters promising easy fun. Only after proving his selflessness by rescuing Geppetto does a fairy transform him into a real boy.",
        [{"name": "Pinocchio", "role": "living puppet"}, {"name": "Geppetto", "role": "woodcarver father"}],
        "A small Italian town and the sea beyond it"))
    t.append(_stub("french_puss_in_boots", "Puss in Boots", "French", "Western Europe",
        "Charles Perrault Puss in Boots",
        "A poor miller's youngest son inherits nothing but a clever cat, who asks only for a pair of boots and a sack, then sets about tricking a kingdom into believing his master is a wealthy marquis. Through a series of bold lies — including convincing an ogre to shrink into a mouse so the cat can eat him — the cat wins his master a castle and a princess.",
        [{"name": "Puss", "role": "clever cat"}, {"name": "the miller's son", "role": "poor heir"}],
        "The French countryside and a nobleman's estate"))
    t.append(_stub("spanish_juan_bobo", "Juan Bobo's Foolish Errands", "Spanish / Caribbean", "Mediterranean Europe",
        "Juan Bobo folktales",
        "Sent by his mother on simple errands, Juan Bobo takes every instruction with such literal, comic foolishness that each task ends in disaster — feeding a pig at the dinner table because he was told to 'treat it like family,' for instance. Each tale plays his foolishness for laughs while quietly warning that instructions matter in the details.",
        [{"name": "Juan Bobo", "role": "well-meaning fool"}, {"name": "his mother", "role": "instruction-giver"}],
        "A rural village in the Spanish-speaking Caribbean"))
    t.append(_stub("dutch_hans_brinker", "Hans Brinker and the Silver Skates", "Dutch", "Western Europe",
        "Hans Brinker silver skates legend",
        "A poor Dutch boy, Hans Brinker, longs to win a pair of silver skates in the town's ice-skating race, even as his family struggles to afford a doctor for his injured father. His patience and honesty — choosing to help his rival rather than compete unfairly — earn him more than the race alone ever could.",
        [{"name": "Hans Brinker", "role": "poor determined boy"}, {"name": "his sister Gretel", "role": "companion"}],
        "A Dutch village of frozen canals"))

    # --- More West/Central/East African ---
    t.append(_stub("congo_leopard_goat_origin", "Why the Leopard and the Goat Never Trust Each Other", "Congolese", "Central Africa",
        "Congolese leopard goat fable",
        "Leopard and Goat once shared a den as friends, splitting every catch evenly, until Leopard secretly starts eating more than his share while Goat sleeps. Goat discovers the trick by marking the meat pile each night, and the two part ways for good — the story explaining why predator and prey no longer share a home.",
        [{"name": "Leopard", "role": "dishonest friend"}, {"name": "Goat", "role": "wronged friend"}],
        "A shared den in the Congo basin forest"))
    t.append(_stub("sudanese_clever_daughter", "The Clever Daughter and the Sultan's Riddles", "Sudanese", "East Africa",
        "Sudanese clever daughter riddle tale",
        "A poor farmer's daughter answers a sultan's impossible riddles on her father's behalf — arriving neither on the road nor off it, neither dressed nor undressed — winning him a pardon for an unpaid debt. Impressed, the sultan tests her further before finally making her his most trusted advisor.",
        [{"name": "the farmer's daughter", "role": "riddle-solver"}, {"name": "the sultan", "role": "riddle-setter"}],
        "A Sudanese village and the sultan's court"))
    t.append(_stub("somali_hare_lion_well", "The Hare and the Lion's Well", "Somali", "East Africa",
        "Somali hare lion well fable",
        "During a drought, only Lion's well has water, and he demands every animal bow before drinking. Hare tricks Lion into thinking a second, more powerful lion lives at the bottom of the well by pointing at his own reflection, and Lion leaps in to fight it, leaving the well free for everyone else.",
        [{"name": "Hare", "role": "trickster"}, {"name": "Lion", "role": "tyrant"}],
        "A single well during a Somali drought"))
    t.append(_stub("malagasy_ibonia", "Ibonia, the Boy Who Chose His Own Birth", "Malagasy", "Southern Africa / Madagascar",
        "Malagasy Ibonia epic",
        "Before he is even born, the hero Ibonia speaks from his mother's womb, choosing the manner and timing of his own birth and naming his own destiny. Grown, he undertakes a series of trials to win a legendary bride, outwitting rival suitors and monstrous obstacles with gifts he was born already knowing how to use.",
        [{"name": "Ibonia", "role": "self-choosing hero"}], "The highlands of Madagascar"))
    t.append(_stub("west_african_spider_famine", "Anansi and the Famine Feast", "Akan / Ashanti", "West Africa",
        "Anansi famine feast tale",
        "During a great famine, Anansi discovers a magic drum that produces food whenever it is tapped in the right rhythm, and he gorges himself in secret rather than share with his starving family. His children eventually catch him mid-feast and take the drum for the whole village, teaching Anansi that hoarding never survives discovery.",
        [{"name": "Anansi", "role": "trickster spider"}, {"name": "Anansi's children", "role": "discoverers"}],
        "A famine-struck Ashanti village"))

    # --- More Native American / Arctic ---
    t.append(_stub("blackfoot_scarface", "Scarface and the Sun's Test", "Blackfoot", "North America",
        "Blackfoot Scarface sun legend",
        "A poor young man scarred since childhood travels to the lodge of the Sun himself to ask how to win the love of a chief's daughter. He proves his worth by saving the Sun's own sons from a flock of deadly birds, and is rewarded with a cure for his scar and permission to marry.",
        [{"name": "Scarface", "role": "scarred suitor"}, {"name": "the Sun", "role": "celestial father"}],
        "The Blackfoot plains and the Sun's lodge in the sky"))
    t.append(_stub("apache_coyote_stars", "Coyote Scatters the Stars", "Apache", "North America",
        "Apache Coyote stars origin tale",
        "The other animals carefully arrange the stars into an orderly pattern meant to teach the constellations' stories, but impatient Coyote grabs the blanket holding the unplaced stars and flings them randomly across the sky. That, the story explains, is why so many stars appear scattered without pattern, unlike the careful few constellations placed first.",
        [{"name": "Coyote", "role": "impatient trickster"}, {"name": "the other animals", "role": "careful planners"}],
        "The night sky above the Apache homeland"))
    t.append(_stub("zuni_corn_maidens", "The Corn Maidens' Return", "Zuni", "North America",
        "Zuni corn maidens legend",
        "The Corn Maidens, spirits who give the people their harvest, leave in sorrow after being disrespected during a dance, and the people face famine in their absence. A young priest sets out to find and apologize to them, and their eventual, cautious return restores balance and the corn crop to the mesa villages.",
        [{"name": "the Corn Maidens", "role": "harvest spirits"}, {"name": "the young priest", "role": "seeker"}],
        "The Zuni mesa villages of the American Southwest"))
    t.append(_stub("haida_raven_creation", "Raven and the First Humans", "Haida", "Pacific Northwest",
        "Haida Raven first humans legend",
        "Wandering a shoreline after the great flood recedes, Raven hears crying from inside a giant clamshell and coaxes the first tiny humans out with careful, curious persuasion. He teaches them to fish and gather before flying off to cause trouble elsewhere, as is his nature even after doing something so important.",
        [{"name": "Raven", "role": "trickster creator"}], "A rocky Pacific Northwest shoreline after the flood"))
    t.append(_stub("tlingit_salmon_boy", "Salmon Boy's Journey Home", "Tlingit", "Pacific Northwest",
        "Tlingit Salmon Boy legend",
        "A boy who disrespects a salmon by feeding it moldy food is swept away and transformed to live among the Salmon People beneath the sea for a full year, learning their laws about respect and reciprocity. Returned to his village transformed and wiser, he becomes a healer who teaches others the same respect for the fish that feed them.",
        [{"name": "Salmon Boy", "role": "transformed protagonist"}, {"name": "the Salmon People", "role": "hosts and teachers"}],
        "A Tlingit fishing village and the sea beneath it"))
    t.append(_stub("cree_wisakedjak_flood", "Wisakedjak and the Great Flood", "Cree", "North America",
        "Cree Wisakedjak flood legend",
        "After a flood covers the whole world, the trickster-hero Wisakedjak sends animal after animal diving to the bottom of the water to bring up a pawful of earth to rebuild the land. Only the humble muskrat succeeds, nearly drowning in the effort, and from that single pawful Wisakedjak rebuilds the entire world on a turtle's back.",
        [{"name": "Wisakedjak", "role": "trickster culture hero"}, {"name": "Muskrat", "role": "humble success"}],
        "A world entirely covered by floodwater"))
    t.append(_stub("inuit_amaguq_wolf", "Amaroq the Wolf and the Lost Hunter", "Inuit", "Arctic North America",
        "Inuit Amaroq wolf hunter tale",
        "A hunter lost in a whiteout storm is guided safely home by a great wolf spirit, Amaroq, who leads without ever letting the man draw close enough to touch him. In gratitude, the hunter's village leaves a share of every catch at the wolf's den from then on, honoring an unspoken bargain between wolves and people.",
        [{"name": "Amaroq", "role": "wolf spirit guide"}, {"name": "the lost hunter", "role": "grateful survivor"}],
        "The Arctic tundra during a whiteout storm"))

    # --- More South Asian regional / Central Asian ---
    t.append(_stub("bengali_thakurmar_jhuli", "The Prince and the Seven Champa Flowers", "Bengali", "South Asia",
        "Bengali Thakurmar Jhuli tale",
        "A jealous co-wife turns the queen's seven sons into champa flower trees out of envy, and only the youngest daughter, spared the same fate, recognizes her brothers' voices calling from the blossoms. She carries the flowers to their father's court and, through patient care, breaks the curse and restores her brothers to human form.",
        [{"name": "the youngest daughter", "role": "loyal rescuer"}, {"name": "the seven brothers", "role": "cursed princes"}],
        "A Bengali royal garden"))
    t.append(_stub("tamil_alli_rani", "Alli Rani, the Warrior Queen", "Tamil", "South Asia",
        "Tamil Alli Rani epic tale",
        "Alli Rani rules a kingdom of women warriors and dismisses every suitor who cannot match her in strategy or combat. When the hero Arjuna arrives determined to win her hand, she sets him a series of escalating trials, agreeing to marriage only after he proves his cleverness equal to her own.",
        [{"name": "Alli Rani", "role": "warrior queen"}, {"name": "Arjuna", "role": "persistent suitor"}],
        "A fortified kingdom of women warriors in Tamil legend"))
    t.append(_stub("rajasthani_gopichand", "King Gopichand's Renunciation", "Rajasthani", "South Asia",
        "Rajasthani Gopichand legend",
        "A powerful young king, Gopichand, is convinced by his yogi mother that true mastery lies in giving up the throne entirely rather than ruling it. He wanders as an ascetic through trials designed to test whether his renunciation is genuine, ultimately proving that discipline, not birthright, defines a true king.",
        [{"name": "Gopichand", "role": "king turned ascetic"}, {"name": "his mother", "role": "spiritual teacher"}],
        "A Rajasthani kingdom and the roads of renunciation beyond it"))
    t.append(_stub("sri_lankan_vessantara", "Prince Vessantara's Generosity", "Sri Lankan (Buddhist)", "South Asia",
        "Sri Lankan Vessantara Jataka",
        "A prince famous for never refusing a request gives away his kingdom's rain-making elephant, his own children, and finally his wife to whoever asks, testing the limits of selfless generosity. Each gift is eventually restored to him by the gods, who conclude his generosity was genuine rather than reckless.",
        [{"name": "Vessantara", "role": "endlessly generous prince"}], "A forest hermitage in ancient Sri Lanka"))
    t.append(_stub("uzbek_khoja_nasreddin", "Khoja Nasreddin and the Borrowed Pot", "Uzbek / Central Asian", "Central Asia",
        "Uzbek Khoja Nasreddin pot tale",
        "Nasreddin borrows a large cooking pot from a neighbor and returns it with a smaller pot inside, claiming the big pot 'gave birth.' Delighted, the neighbor happily lends more pots — until Nasreddin later borrows one and never returns it, explaining simply that the pot 'died,' and the neighbor cannot argue with the same logic he once accepted.",
        [{"name": "Khoja Nasreddin", "role": "wise fool"}, {"name": "the neighbor", "role": "outwitted lender"}],
        "A Central Asian village marketplace"))
    t.append(_stub("armenian_nazar_the_brave", "Nazar the Brave", "Armenian", "Caucasus",
        "Armenian Nazar the Brave tale",
        "A cowardly tailor accidentally kills a swarm of flies in one swat and boasts of it on his belt, which passing strangers misread as a claim of killing seven men at once. His accidental reputation for bravery grows so large that real threats begin fleeing from him before he even understands why he's famous.",
        [{"name": "Nazar", "role": "accidental hero"}], "An Armenian village in the Caucasus mountains"))
    t.append(_stub("georgian_amirani", "Amirani, Chained to the Mountain", "Georgian", "Caucasus",
        "Georgian Amirani Prometheus-like legend",
        "The demigod Amirani challenges the sky god himself out of pride and is chained to a mountain peak as punishment, with an eagle sent to tear at his side each day. Every year the wound heals overnight, and a blacksmith's hammering across the valley is said to be the sound of chains being reforged to keep him bound.",
        [{"name": "Amirani", "role": "chained demigod"}], "A mountain peak in the Caucasus"))

    # --- More East/Southeast Asian ---
    t.append(_stub("chinese_white_snake", "The Legend of the White Snake", "Chinese", "East Asia",
        "Chinese White Snake legend",
        "A thousand-year-old snake spirit takes human form as a woman and falls in love with a young scholar, hiding her true nature to build a life with him. A monk who senses what she is forces a confrontation that reveals her true form, testing whether love can survive the truth of what someone really is underneath.",
        [{"name": "the White Snake", "role": "snake spirit"}, {"name": "the scholar", "role": "husband"}, {"name": "the monk", "role": "antagonist"}],
        "A lakeside town in ancient China"))
    t.append(_stub("chinese_mulan", "Mulan Takes Her Father's Place", "Chinese", "East Asia",
        "Chinese Mulan legend",
        "When the emperor's draft notice arrives naming her aging, ailing father, Hua Mulan disguises herself as a man and takes his place in the army instead. She serves for over a decade without her fellow soldiers discovering her identity, returning home a decorated general before finally revealing who she really is.",
        [{"name": "Mulan", "role": "disguised soldier"}, {"name": "her father", "role": "the man she protects"}],
        "Northern China during a military draft"))
    t.append(_stub("japanese_issun_boshi", "Issun-boshi, the One-Inch Boy", "Japanese", "East Asia",
        "Japanese Issun-boshi tale",
        "Born no bigger than a fingertip to parents who prayed for any child at all, Issun-boshi sets off to the capital with a needle for a sword and a soup bowl for a boat to make his fortune. He defeats a demon that swallows him whole by stabbing from the inside, and is rewarded with a magic mallet that grows him to full human size.",
        [{"name": "Issun-boshi", "role": "tiny hero"}], "A rural home and the imperial capital of Japan"))
    t.append(_stub("japanese_kachikachi_mountain", "Kachi-Kachi Mountain", "Japanese", "East Asia",
        "Japanese Kachi-Kachi Mountain tale",
        "A cruel raccoon-dog, tanuki, kills a farmer's wife, and a rabbit friend of the farmer sets out to avenge her through a careful sequence of escalating tricks — a burning bundle of sticks, a pepper-paste poultice, a boat made of mud. Each trick punishes the tanuki a little more severely than the last, until justice is finally, fully served.",
        [{"name": "the rabbit", "role": "avenger"}, {"name": "the tanuki", "role": "villain"}],
        "A mountain and a farmer's field in rural Japan"))
    t.append(_stub("korean_dokkaebi_bat", "The Dokkaebi's Magic Bat", "Korean", "East Asia",
        "Korean dokkaebi magic bat tale",
        "A poor woodcutter accidentally overhears a band of goblin-spirits, dokkaebi, using a magic bat that produces gold with every tap, and steals it while they are distracted playing games. A greedy neighbor tries to copy the trick and gets caught, receiving a stretched-out nose instead of gold as punishment for imitating without understanding.",
        [{"name": "the woodcutter", "role": "lucky discoverer"}, {"name": "the dokkaebi", "role": "goblin spirits"}],
        "A forest in old Korea"))
    t.append(_stub("indonesian_malin_kundang", "Malin Kundang, the Ungrateful Son", "Indonesian (Minangkabau)", "Southeast Asia",
        "Indonesian Malin Kundang legend",
        "A poor fisherman's son leaves home to seek his fortune and returns years later as a wealthy merchant who publicly disowns his own aging, humble mother in front of his new wife. Heartbroken, she curses him, and his ship and crew are turned to stone on the spot — a rocky formation still pointed to on the coast today.",
        [{"name": "Malin Kundang", "role": "ungrateful son"}, {"name": "his mother", "role": "wronged parent"}],
        "A fishing village and harbor on the coast of Sumatra"))
    t.append(_stub("malay_sang_kancil", "Sang Kancil Outwits the Crocodiles", "Malay", "Southeast Asia",
        "Malay Sang Kancil mousedeer tale",
        "A clever mousedeer, Sang Kancil, needs to cross a river full of hungry crocodiles to reach fruit on the other side, so he tricks them into lining up to be 'counted' for the king. He hops safely across their backs one by one, escaping while the crocodiles are still waiting for a reward that was never coming.",
        [{"name": "Sang Kancil", "role": "trickster mousedeer"}, {"name": "the crocodiles", "role": "outwitted predators"}],
        "A river crossing in the Malay jungle"))
    t.append(_stub("burmese_ma_htwe_princess", "Princess Ma Htwe and the Ogre", "Burmese", "Southeast Asia",
        "Burmese ogre princess folk tale",
        "An ogre disguises himself as a handsome prince to court Princess Ma Htwe, and only her clever younger brother notices the telltale signs — the ogre's shadow falls wrong, and he eats an entire buffalo at once when he thinks no one is watching. The brother's careful, patient proof saves the kingdom from the marriage before it's too late.",
        [{"name": "Ma Htwe", "role": "princess"}, {"name": "her younger brother", "role": "clever observer"}],
        "A Burmese royal court"))
    t.append(_stub("tibetan_seven_princesses", "The Seven Princesses and the Wishing Tree", "Tibetan", "Central Asia",
        "Tibetan seven princesses wishing tree tale",
        "Seven sisters set out together to find a legendary wishing tree said to grant one true wish to whoever reaches it first. Each sister is tempted by an easier prize along the way, and only the youngest, who resists every shortcut, completes the journey and must decide how to use the wish fairly for all seven.",
        [{"name": "the youngest princess", "role": "persistent seeker"}, {"name": "her six sisters", "role": "tempted travelers"}],
        "A mountain path in the Tibetan plateau"))

    # --- More Middle Eastern / Mediterranean / European ---
    t.append(_stub("lebanese_phoenix_ashes", "The Phoenix of the Cedars", "Lebanese / Phoenician", "Middle East",
        "Lebanese phoenix cedar legend",
        "A magnificent bird nesting in the ancient cedars is said to burn itself completely to ash once every five hundred years, and a new phoenix is born from the embers left behind. Villagers who witness the cycle treat the ash-fall as a blessing for the coming harvest, since the bird's rebirth marks the turning of a great age.",
        [{"name": "the Phoenix", "role": "self-renewing bird"}], "The ancient cedar forests of Lebanon"))
    t.append(_stub("moroccan_aicha_kandicha", "Aicha Kandicha's Riverside Bargain", "Moroccan (Amazigh)", "North Africa",
        "Moroccan Aicha Kandicha legend",
        "A spirit woman with the legs of a goat lingers by riverbanks and wells, offering travelers a bargain that always sounds better than it turns out to be. Only those who recognize the trick in her offer — never accepting a gift without asking its price first — pass safely on their way.",
        [{"name": "Aicha Kandicha", "role": "riverside spirit"}], "A riverside crossing in rural Morocco"))
    t.append(_stub("basque_tartalo_cyclops", "Tartalo the One-Eyed Giant", "Basque", "Western Europe",
        "Basque Tartalo cyclops tale",
        "A shepherd trapped in a one-eyed giant's cave escapes by blinding Tartalo with a heated spit and hiding among the sheep as they're let out to graze, wrapped in a fleece so the giant can only feel wool, not a man. It is one of the oldest tales in Europe still told almost exactly the same way today.",
        [{"name": "the shepherd", "role": "clever captive"}, {"name": "Tartalo", "role": "one-eyed giant"}],
        "A mountain cave in the Basque country"))
    t.append(_stub("romani_bear_and_girl", "The Bear Who Loved a Miller's Daughter", "Romani", "Eastern Europe",
        "Romani bear miller's daughter tale",
        "A wandering bear falls for a miller's daughter and offers her family untold wealth if she'll marry him, not realizing he is actually a cursed prince trapped in bear form. Her patient kindness toward him, rather than fear, is what finally breaks the enchantment and reveals the man underneath.",
        [{"name": "the miller's daughter", "role": "patient bride"}, {"name": "the bear", "role": "cursed prince"}],
        "A milling village somewhere along the Romani travel routes of Eastern Europe"))
    t.append(_stub("czech_golden_haired_twins", "The Golden-Haired Twins", "Czech / Slavic", "Eastern Europe",
        "Czech golden haired twins folktale",
        "A jealous queen swaps her sister-in-law's newborn golden-haired twins for puppies and has them set adrift on a river to hide the truth. Raised by a miller, the twins grow up unaware of their birthright until a chance encounter at court reveals their golden hair and the queen's long-hidden deception.",
        [{"name": "the twins", "role": "hidden heirs"}, {"name": "the jealous queen", "role": "schemer"}],
        "A river and a royal court in old Bohemia"))
    t.append(_stub("bulgarian_lazy_wife", "The Lazy Wife and the Talking Cat", "Bulgarian", "Eastern Europe",
        "Bulgarian lazy wife folktale",
        "A husband tired of his wife's refusal to do any housework trains the family cat to 'complain' about her laziness whenever guests visit, embarrassing her into finally helping around the house. She eventually discovers the trick, but by then the habit of working together has already taken hold.",
        [{"name": "the wife", "role": "reluctant worker"}, {"name": "the husband", "role": "schemer"}],
        "A rural Bulgarian household"))
    t.append(_stub("serbian_baš_čelik", "Steelbeard's Three Kingdoms", "Serbian", "Eastern Europe",
        "Serbian Baš Čelik legend",
        "A monstrous captor called Steelbeard keeps three princesses hidden in nested underground kingdoms, freed only by a hero clever enough to survive a night alone in a haunted church first. Each kingdom's rescue requires a different kind of courage, from patience to outright combat, before all three princesses can be brought home.",
        [{"name": "the hero", "role": "rescuer"}, {"name": "Baš Čelik", "role": "monstrous captor"}],
        "Nested underground kingdoms beneath a haunted church"))
    t.append(_stub("sami_stallo_giant", "Outwitting Stállu the Giant", "Sami", "Northern Europe",
        "Sami Stallo giant folktale",
        "Stállu, a slow-witted but dangerous giant, repeatedly tries to catch and eat a clever herder boy who always escapes through some trick of timing or riddles the giant can't quite follow. Each tale ends with Stállu a little more humiliated and a little more determined to try again next winter.",
        [{"name": "the herder boy", "role": "trickster"}, {"name": "Stállu", "role": "slow giant"}],
        "The snowy tundra of the Sami homeland"))
    t.append(_stub("icelandic_grettir_saga", "Grettir Wrestles the Undead", "Icelandic", "Northern Europe",
        "Icelandic Grettir saga excerpt",
        "The outlaw hero Grettir the Strong takes on a haunted farmstead by wrestling its undead former shepherd, Glam, through a single brutal night of combat. Grettir wins, but not without being cursed by Glam's dying words to a life of bad luck and fear of the dark for the rest of his days.",
        [{"name": "Grettir", "role": "outlaw hero"}, {"name": "Glam", "role": "undead shepherd"}],
        "A haunted Icelandic farmstead"))
    t.append(_stub("portuguese_enchanted_moura", "The Enchanted Moura of the Well", "Portuguese", "Mediterranean Europe",
        "Portuguese enchanted Moura legend",
        "A beautiful enchanted woman, a Moura, sits combing golden hair beside an old well, cursed to guard a hidden treasure until someone breaks the spell with exactly the right act of courage or kindness. Many try and fail by grabbing for the treasure too greedily; only a patient stranger who asks for nothing eventually earns her freedom.",
        [{"name": "the Moura", "role": "enchanted guardian"}], "An old well in the Portuguese countryside"))

    # --- More Pacific / South American ---
    t.append(_stub("fijian_degei_serpent", "Degei, the Great Serpent God", "Fijian", "Pacific",
        "Fijian Degei serpent creation legend",
        "The great serpent god Degei lives coiled in a cave and is said to control the seasons, turning over in his sleep to cause earthquakes when angered by human misbehavior. Villagers track his moods through the tides and winds, treating storms as a signal to correct some imbalance in how the community is behaving.",
        [{"name": "Degei", "role": "serpent god"}], "A sacred cave on the Fijian islands"))
    t.append(_stub("tongan_maui_islands", "Maui Pulls Up Tonga", "Tongan (Polynesian)", "Pacific",
        "Tongan Maui islands legend",
        "Fishing far from home with a hook made from his grandmother's jawbone, Maui hauls up an entire chain of islands from the ocean floor, believing at first he has caught only a single enormous fish. His brothers, impatient as always, begin cutting the catch loose before the ritual blessing is complete, shaping Tonga's uneven island chain in the process.",
        [{"name": "Maui", "role": "demigod trickster-hero"}], "The open Pacific Ocean"))
    t.append(_stub("peruvian_inkarri", "Inkarrí's Return", "Quechua (Inca)", "South America",
        "Peruvian Inkarri legend",
        "After the last Inca king is executed by conquering forces, legend holds that his severed head is buried and slowly regrowing a new body underground, limb by limb, over centuries. When Inkarrí is finally whole again, the old order is said to return — a story of patient, generational hope kept alive across Andean villages.",
        [{"name": "Inkarrí", "role": "buried, regrowing king"}], "Underground beneath the Andean highlands"))
    t.append(_stub("colombian_el_dorado", "The Golden Chief of the Lake", "Muisca", "South America",
        "Colombian El Dorado ceremony legend",
        "Each time a new chief is crowned, he is covered head to toe in gold dust and rowed to the center of a sacred lake, where he dives in to wash the gold away as an offering to the gods below. Treasure thrown from the shores follows him into the water, seeding the legend of a golden city that outside explorers would later chase in vain.",
        [{"name": "the golden chief", "role": "ceremonial figure"}], "A sacred lake in the Colombian highlands"))
    t.append(_stub("argentine_pombero", "Pombero, Spirit of the Wild", "Guaraní (Argentine/Paraguayan)", "South America",
        "Argentine Pombero forest spirit legend",
        "A small, hairy forest spirit named Pombero protects birds and wildlife, punishing hunters who take more than they need with lost tools, tangled hair, or unsettling whistles in the night. Farmers leave small offerings of honey and tobacco at the forest's edge to keep him friendly rather than mischievous.",
        [{"name": "Pombero", "role": "forest guardian spirit"}], "The wooded countryside of Argentina and Paraguay"))
    t.append(_stub("chilean_pincoya_sea", "La Pincoya's Tides", "Chilote", "South America",
        "Chilean Pincoya sea spirit legend",
        "A beautiful sea spirit, La Pincoya, dances on the shore facing out to sea when fish are plentiful, or facing inland when the catch will be poor — and local fishermen read her dance before deciding whether to sail at all. Some claim to have seen her guide entire schools of fish toward a lucky boat's nets.",
        [{"name": "La Pincoya", "role": "sea spirit"}], "The rocky coastline of Chiloé, Chile"))

    # --- More Aboriginal Australian ---
    t.append(_stub("aboriginal_emu_stars", "How the Emu Got Into the Sky", "Aboriginal Australian", "Oceania",
        "Aboriginal emu in the sky legend",
        "Two brothers kill an emu unfairly during a hunt they'd agreed to share evenly, and the emu's spirit rises into the night sky as a dark shape traced between the stars of the Milky Way rather than a constellation of bright points. The story is used to teach children that broken promises leave a mark that lasts.",
        [{"name": "the two brothers", "role": "unfair hunters"}, {"name": "the emu", "role": "wronged spirit"}],
        "The night sky above the Australian outback"))
    t.append(_stub("aboriginal_how_kangaroo_got_pouch", "How Kangaroo Got Her Pouch", "Aboriginal Australian", "Oceania",
        "Aboriginal kangaroo pouch origin legend",
        "In the Dreaming, Kangaroo carries her joey everywhere clutched awkwardly in her front paws, exhausted and unable to gather food properly. A grateful lizard she once helped weaves her a fold of skin into a natural pouch, freeing her hands and giving all kangaroos since a built-in carrier for their young.",
        [{"name": "Kangaroo", "role": "exhausted mother"}, {"name": "the lizard", "role": "grateful helper"}],
        "The Australian bush during the Dreaming"))

    # --- Additional Aesop-tradition, Jewish, Norse, and catch-all entries ---
    t.append(_stub("aesop_tortoise_hare", "The Tortoise and the Hare", "Greek (Aesop)", "Mediterranean Europe",
        "Aesop tortoise hare fable",
        "A boastful hare mocks a slow tortoise's pace and agrees to a footrace he's certain to win without effort, so certain that he stops to nap halfway through. The tortoise's steady, uninterrupted plodding carries him past the sleeping hare and across the finish line first, proving persistence can beat raw speed.",
        [{"name": "the Tortoise", "role": "steady competitor"}, {"name": "the Hare", "role": "overconfident competitor"}],
        "A country racetrack in Aesop's Greece"))
    t.append(_stub("aesop_ant_grasshopper", "The Ant and the Grasshopper", "Greek (Aesop)", "Mediterranean Europe",
        "Aesop ant grasshopper fable",
        "All summer the grasshopper sings and mocks the ants for their tireless work storing grain, certain that food will always be easy to find. When winter comes and the grasshopper has nothing saved, the ants' careful preparation is the only thing standing between the whole colony and hunger.",
        [{"name": "the Ant", "role": "diligent worker"}, {"name": "the Grasshopper", "role": "carefree singer"}],
        "A field across a full year's seasons"))
    t.append(_stub("aesop_boy_who_cried_wolf", "The Boy Who Cried Wolf", "Greek (Aesop)", "Mediterranean Europe",
        "Aesop boy cried wolf fable",
        "A bored shepherd boy repeatedly tricks the villagers into rushing to save him from a wolf that isn't really there, laughing each time at how easily they believe him. When a real wolf finally appears, no one comes running anymore, having learned not to trust his cries.",
        [{"name": "the shepherd boy", "role": "repeat liar"}, {"name": "the villagers", "role": "worn-out rescuers"}],
        "A pasture on the edge of a Greek village"))
    t.append(_stub("jewish_dybbuk_box", "The Dybbuk's Bargain", "Jewish (Eastern European)", "Middle East / Diaspora",
        "Jewish dybbuk folklore",
        "A restless, wandering spirit called a dybbuk possesses a young bride on the eve of her wedding, speaking through her voice to reveal a debt left unpaid from a life cut short. Only a rabbi skilled in exorcism can negotiate the spirit's peaceful departure, teaching the community that unfinished business doesn't simply disappear with death.",
        [{"name": "the bride", "role": "possessed young woman"}, {"name": "the rabbi", "role": "exorcist"}],
        "A shtetl wedding in Eastern Europe"))
    t.append(_stub("jewish_lamed_vav", "The Thirty-Six Hidden Saints", "Jewish", "Middle East / Diaspora",
        "Jewish Lamed Vav tzadikim legend",
        "According to legend, the world is sustained at all times by thirty-six hidden righteous people, the Lamed Vav, who never know their own importance and often live as the poorest and most overlooked members of society. The tale teaches that any humble stranger might be one of them, so kindness should never depend on knowing who deserves it.",
        [{"name": "the hidden righteous ones", "role": "unknowing saviors of the world"}],
        "Ordinary towns across the Jewish diaspora"))
    t.append(_stub("norse_valkyries_choice", "The Valkyrie's Choice", "Norse / Scandinavian", "Northern Europe",
        "Norse Valkyrie battlefield legend",
        "A Valkyrie sent to choose which warriors die in battle and which live falls in love with a mortal soldier she is meant to mark for death. She defies Odin's order to spare him, and is punished by being cast into a mortal sleep behind a wall of fire, waking only for a hero brave enough to cross the flames.",
        [{"name": "the Valkyrie", "role": "battlefield chooser"}, {"name": "the mortal soldier", "role": "spared warrior"}],
        "A Norse battlefield and a fire-ringed mountain"))
    t.append(_stub("norse_yggdrasil_squirrel", "Ratatoskr, the Gossiping Squirrel", "Norse / Scandinavian", "Northern Europe",
        "Norse Ratatoskr Yggdrasil tale",
        "A squirrel named Ratatoskr races up and down the trunk of the world tree Yggdrasil, carrying insults back and forth between the eagle at its top and the serpent gnawing its roots below. Neither creature can reach the other to settle the feud directly, so the quarrel — and Ratatoskr's busy work — never really ends.",
        [{"name": "Ratatoskr", "role": "gossiping squirrel"}], "The trunk of the world tree, Yggdrasil"))
    t.append(_stub("welsh_taliesin_birth", "The Birth of Taliesin", "Welsh (Celtic)", "British Isles",
        "Welsh Taliesin transformation legend",
        "A servant boy accidentally tastes three drops from the witch Ceridwen's cauldron of inspiration meant for her own son, gaining all its wisdom instead. Fleeing her fury, he shape-shifts through a chase of hare, fish, and bird before being swallowed as a single grain of wheat by a hen — and reborn nine months later as the poet Taliesin.",
        [{"name": "Taliesin", "role": "reborn poet"}, {"name": "Ceridwen", "role": "witch"}],
        "A witch's cottage and cauldron in ancient Wales"))
    t.append(_stub("scottish_kelpie_loch", "The Kelpie of the Loch", "Scottish (Celtic)", "British Isles",
        "Scottish kelpie water horse legend",
        "A kelpie disguises itself as a beautiful, gentle horse grazing by the loch, luring curious children to climb on its back for a ride. Once mounted, riders find they cannot let go of its sticky hide, and the kelpie plunges into the deep water with them — a warning tale told to keep children away from dangerous lochs.",
        [{"name": "the kelpie", "role": "shape-shifting water spirit"}], "A Scottish loch"))
    t.append(_stub("english_dick_whittington", "Dick Whittington and His Cat", "English", "British Isles",
        "English Dick Whittington folk tale",
        "A penniless orphan travels to London believing its streets are paved with gold, and finds only hardship until his one possession, a clever cat, is sold abroad for a fortune to a rat-plagued foreign king. Whittington returns wealthy and eventually becomes Lord Mayor of London three times, all traced back to a single cat's skill.",
        [{"name": "Dick Whittington", "role": "poor orphan"}, {"name": "his cat", "role": "fortune-maker"}],
        "London and a foreign trading port"))
    t.append(_stub("hawaiian_pele_volcano", "Pele's Fire and Her Sister's Forests", "Hawaiian (Polynesian)", "Pacific",
        "Hawaiian Pele volcano goddess legend",
        "The fire goddess Pele searches island to island for a permanent home, digging fire pits that fill with seawater and fail until she reaches the Big Island's volcano. Her rivalry with her forest-goddess sister Hiʻiaka — lava versus green growth — is said to still play out every time an eruption burns forest that later regrows.",
        [{"name": "Pele", "role": "volcano goddess"}, {"name": "Hiʻiaka", "role": "forest goddess sister"}],
        "The volcanic islands of Hawaii"))
    t.append(_stub("maori_tane_light", "Tāne Separates Earth and Sky", "Māori (Polynesian)", "Pacific",
        "Maori Tane creation legend",
        "In the beginning, Sky Father and Earth Mother are locked in such a tight embrace that their children live crushed in permanent darkness between them. Tāne, strongest of the children, plants his shoulders against the earth and pushes the sky upward with his legs, prying the two apart and letting light into the world for the first time.",
        [{"name": "Tāne", "role": "sky-separating god"}, {"name": "Ranginui and Papatūānuku", "role": "sky father and earth mother"}],
        "The primordial darkness before earth and sky were separated"))
    t.append(_stub("egyptian_cinderella_rhodopis", "Rhodopis and the Rose-Red Slippers", "Egyptian (Greek-Egyptian)", "North Africa",
        "Egyptian Rhodopis Cinderella tale",
        "An enslaved Greek girl in Egypt has one rose-red slipper snatched by a falcon and dropped in the pharaoh's lap while he holds court, and he vows to find the woman it belongs to. Considered one of the oldest recorded Cinderella-type stories in the world, it ends with Rhodopis becoming his queen.",
        [{"name": "Rhodopis", "role": "enslaved girl"}, {"name": "the Pharaoh", "role": "slipper-seeker"}],
        "The Nile valley under Pharaonic rule"))
    t.append(_stub("babylonian_gilgamesh_flood", "Gilgamesh and the Plant of Immortality", "Babylonian / Mesopotamian", "Middle East",
        "Mesopotamian Gilgamesh flood legend",
        "Grieving the death of his closest friend, King Gilgamesh travels to the edge of the world seeking the secret of immortality, and is told of a thorny plant hidden at the bottom of the sea that can restore youth. He retrieves it after a difficult dive, only for a serpent to steal it while he bathes, leaving him to accept mortality after all.",
        [{"name": "Gilgamesh", "role": "grieving king"}, {"name": "the serpent", "role": "thief"}],
        "Ancient Mesopotamia and the edge of the known world"))
    t.append(_stub("west_african_why_spider_bald", "Why Spider Has a Bald Head", "Akan / Ashanti", "West Africa",
        "Anansi bald head origin tale",
        "Invited to two feasts happening at the same time in different villages, greedy Anansi ties a rope to each ankle so he can be pulled to whichever feast is ready first without missing either. Both feasts start at the exact same moment, and he is stretched agonizingly between them, his head scorched bald by the cooking fires on both sides.",
        [{"name": "Anansi", "role": "trickster spider"}], "Two villages holding feasts on the same night"))
    t.append(_stub("indian_savitri_yama", "Savitri Outwits the God of Death", "Indian", "South Asia",
        "Indian Savitri Yama legend",
        "Savitri marries a man fated to die within a year despite being warned of the prophecy, and when Yama, god of death, comes to claim his soul, she follows the god on foot rather than turning back. Her persistence and clever wordplay convince Yama to grant her a series of boons, the last of which reverses her husband's death entirely.",
        [{"name": "Savitri", "role": "devoted wife"}, {"name": "Yama", "role": "god of death"}],
        "A forest hermitage in ancient India"))
    t.append(_stub("chinese_eight_immortals", "The Eight Immortals Cross the Sea", "Chinese", "East Asia",
        "Chinese Eight Immortals legend",
        "Eight legendary immortals, each with a different magical object and origin story, are challenged to cross the ocean without using a boat. Each uses a completely different method — a flute, a fan, a bamboo drum — showing that there's more than one right way to solve the very same problem.",
        [{"name": "the Eight Immortals", "role": "legendary travelers"}], "The sea between the mortal world and the immortals' isles"))

    return t


def build_catalog(query_limit: int | None = None) -> list[dict]:
    curated = build_curated_tales()
    seen = {t["id"] for t in curated}
    print(f"  curated tales: {len(curated)}")

    gutenberg = fetch_gutenberg_entries(query_limit=query_limit)
    fresh_gutenberg = []
    for entry in gutenberg:
        if entry["id"] in seen:
            continue
        seen.add(entry["id"])
        fresh_gutenberg.append(entry)
    print(f"  Gutenberg (Gutendex) tales after de-dup: {len(fresh_gutenberg)}")

    return curated + fresh_gutenberg


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="output path for folk_catalog.json")
    parser.add_argument("--dry-run", action="store_true", help="count only, do not write output")
    parser.add_argument("--query-limit", type=int, default=None, help="limit number of Gutendex search queries (debug)")
    args = parser.parse_args()

    print("Building folk tale catalog...")
    catalog = build_catalog(query_limit=args.query_limit)
    print(f"Total catalog entries: {len(catalog)}")

    if args.dry_run:
        print("--dry-run: no files written.")
        return

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {len(catalog)} entries to {args.out}")


if __name__ == "__main__":
    main()
