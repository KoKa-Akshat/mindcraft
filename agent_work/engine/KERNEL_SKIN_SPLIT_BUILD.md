# BUILD — Kernel / skin split for generated questions

**Status:** ready to implement. **Written 2026-08-18.**
**Amends** [`INGREDIENT_FIRST_GENERATION_BUILD.md`](INGREDIENT_FIRST_GENERATION_BUILD.md)
(§8 emission). Not a new architecture — it names and separates two things the
pilot already builds together.

**Lane: Engine.** Owned paths:
```
ml/generation/models.py            add Kernel / Skin types
ml/generation/ingredient_first.py  emit three artifacts instead of one
ml/data/generated/**               kernels.jsonl + skins.jsonl + items.json
ml/tests/**                        new tests
```
No `app/**` change: `items.json` keeps the exact `questionBank.Question` shape.

---

## 1. Why

Ingredients now carry `concept_ids: list[str]` (Stage 1 of the ontology
restructure). An item generated from an ingredient set therefore has **no single
concept story world** — its ingredients may belong to several concepts, each with
its own narrative. Story-first delivery (CLAUDE.md: *"The math is frozen; the
narrative wraps it"*) needs one wrapper per presentation, not one per item.

Splitting the frozen math (**kernel**) from the presentation (**skin**) resolves
that, and the split is worth more than the problem that prompted it — see §4.

---

## 2. Both halves already exist; they just cannot join

**The kernel is already implicit.** `(template_id, seed, params)` in
`provenance.jsonl` fully determines the math — proven by the existing replay
test, which reproduces items byte-identically from that triple.

**The skin is already prototyped.** `ml/data/story_cells/batch_ingredient_fable5_reskin.json`
carries `reskin_of`, `base_batch`, `presentation`, `storyContext` — exactly this
shape, built for 3 reskins and then stalled.

**The missing piece is one field:** the kernel has no stable public ID, so a skin
has nothing to point at. Promote `kernel_id` to a first-class emitted object and
the two halves join. This is a small change, not a rebuild.

---

## 3. Emission: three artifacts

```
kernels.jsonl   kernel_id, template_id, seed, params, ingredient_ids (Q-vector),
                level, key, choices as VALUES, per-distractor rule_id +
                failure_signature + misconception_id      <- the frozen math
skins.jsonl     skin_id, kernel_id, concept_id, story_world, format,
                stem prose, storyContext, storyIntro, hints, explanation
                                                          <- the dressing
items.json      the join, in exact questionBank.Question shape   <- what ships
```

`kernel_id` is derived deterministically from `(generator_version, template_id,
seed)` — a hash, not a counter, so it is stable across runs and reorderings.

**`distractor_taxonomy` belongs to the kernel, not the skin.** A misconception is
a property of the math (executing the faulty procedure on *this problem* yields
*this value*), not of the story. Keeping it kernel-side means a tagged distractor
can never be lost or garbled by reskinning — which is the failure the whole
generation reframe exists to prevent.

One kernel may have many skins. `items.json` is the cross product actually
selected for shipping, not necessarily every (kernel, skin) pair.

---

## 4. What the split buys — and the modelling decision

### 4.1 Kernels are the unit of psychometric identity

The predictor is blocked at **148 observations against 179 ingredients**. If
difficulty is invariant across narrative skins of one kernel, then a response to
*any* skin is evidence about that kernel, and responses **pool**. Ten skins of a
kernel become 10× the evidence at no extra authoring cost. That is a direct
attack on the data blocker, not a nicety.

### 4.2 Record, don't model (the decision)

**Do NOT one-hot the story world.** Three reasons, in order of force:

1. **Parameter cost at the worst possible time.** AFM ≈ 360 parameters, PFA ≈ 537,
   against 148 observations. A one-hot per story world adds parameters to a model
   that already cannot fit the ones it has.
2. **It estimates the wrong quantity.** A one-hot learns a *global* per-world
   offset ("the kitchen world is 0.3 harder"). The interesting question is whether
   a story helps *this student* on *this kernel* — an interaction, which costs far
   more data than a main effect.
3. **It cannot generalise.** A one-hot for `kitchen` says nothing about a new
   `harbor` world; every added world would need its own data before being usable.
   `WORLD_VISION.md` is explicitly about the world expanding as mastery grows —
   taxing new worlds is precisely backwards.

**Instead: store `skin_id`, `story_world`, and `format` on every observation, and
model none of them.** Zero parameters, zero fitting cost, and the evidence is
already on disk the day the question becomes answerable. Same discipline as drop
retention: capture now because capture is nearly free, decide when you can
measure.

### 4.3 Format vs narrative — and an honest status note

| the reskin changes | treatment |
|---|---|
| **Format** (symbolic_expression → word_problem → diagram) | A different *vessel*, not dressing. Its designated home is Layer 4 `representation_profile` (6 per-format strength scores). |
| **Narrative only**, format held constant (workshop → kitchen) | Record; do not model. |

> **Status correction, verified 2026-08-18:** `representation_profile` is **Layer 4
> schema only — it is not implemented.** It appears in the live engine exactly
> once, in a *comment* at `ml/mindcraft_graph/config.py:14`; there is no format
> field on `student_state.py` and no update path. CLAUDE.md's "only Layer 1 is
> wired" note covers this.
>
> **Consequence for this build: today, format reskins are recorded and not
> modelled either** — same as narrative. The table above is the target state once
> the format axis is actually built, not a description of what happens now. Do not
> write code that assumes `representation_profile` exists.

### 4.4 The trap — skins do not create Q-vector diversity

The current run reports **3 distinct Q-vectors, largest identical group 16**. That
is a property of the *kernels*. Generating ten skins each yields 480 items and
still 3 Q-vectors, and the AFM/PFA same-Q-vector precondition stays exactly as
unmet as it is now.

**Skins multiply evidence per kernel. Only new templates and rules multiply item
structure.** A larger `items.json` must never be read as progress on the
predictor. State this in the run report next to the Q-vector distinctness count.

---

## 5. The skin-invariance experiment (pre-register before running)

The pooling in §4.1 is licensed by an assumption, so test it the way the 2-param
predictor was tested — hypothesis and stopping rule written down first.

- **H₀:** narrative skin has no effect on item difficulty at constant format.
- **Design:** serve ≥2 narrative skins of the same kernels to comparable students;
  compare per-kernel difficulty across skins.
- **Decision rule, fixed in advance:** if the skin effect is indistinguishable
  from zero at the pre-registered threshold → pool responses across narrative
  skins and record that pooling is licensed. If not → skin becomes a modelled
  factor, and a **hierarchical / partially-pooled** term (sharing strength across
  worlds) rather than a one-hot.
- **Either outcome is publishable internally.** A real skin effect is a finding
  about story-first pedagogy — a core product bet in `WORLD_VISION.md` that has
  never been measured.
- **Honest precondition:** this cannot run at n=148 from two founders. Spec the
  logging now; run the experiment when real usage exists. Do not mark it done.

---

## 6. Acceptance criteria

1. `kernels.jsonl`, `skins.jsonl`, `items.json` all emitted; `items.json` remains
   byte-identical in shape to the current `questionBank.Question` output.
2. `kernel_id` is a stable hash of `(generator_version, template_id, seed)` —
   re-running reproduces the same ids; reordering does not change them.
3. Every skin references an existing `kernel_id`; zero orphans, enforced by test.
4. `distractor_taxonomy` is emitted from the kernel; every shipped non-key choice
   still carries `rule_id` + `failure_signature` (unchanged from the pilot).
5. **Two narrative skins of one kernel produce identical choice values and an
   identical key index** — the invariant that makes pooling coherent. Test it.
6. Run report prints kernel count, skin count, skins-per-kernel, **and** the
   Q-vector distinctness figures with the §4.4 caveat printed beside them.
7. Replay determinism holds for kernels; skins may vary when LLM-authored, so
   assert determinism on the kernel layer only.
8. 133+ tests and end2end 85/85 stay green. No `app/**` change.

---

## 7. Non-goals

- **No one-hot, no skin parameter, no new mastery axis.** §4.2.
- **No `representation_profile` implementation.** That is its own build; this
  spec only avoids blocking it.
- **No client sync.** `items.json` stops in `ml/data/generated/`.
- **No new templates or rules.** This is a restructure of emission; the 130-item
  rule worklist is authored separately.
