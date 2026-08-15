---
name: repo-hygiene
description: Find and safely remove stale docs, dead code, and orphaned files in this repo without breaking anything actively referenced. Use when the user says clean up the repo, delete junk, streamline the codebase, or asks what's safe to remove.
---

# Repo Hygiene

This repo accumulates one-off planning docs fast — every past agent session
(Codex, Cursor, Claude) tends to drop a `*_BUILD.md`, `*_HANDOFF.md`,
`*_PLAN.md`, or `*_AUDIT.md` at the repo root when it finishes a task. Most
of these are historical once the work ships; a few are living references
that must never be deleted. This skill is the repeatable process for telling
them apart, plus the same idea applied to dead code (orphaned features,
unused files) — not just markdown.

**Prior art**: `REPO_CLEANUP_AUDIT.md` at the repo root is an earlier pass at
exactly this (2026-06-28, focused on assets/git hygiene/CSS). Read it first —
don't redo analysis it already did, and follow its "Non-Negotiable Rules"
(don't delete tracked source/assets/configs without explicit classification
or user approval; confirm before touching anything under "Needs Owner
Confirmation").

## Never delete without checking

These are canonical/authoritative per `CLAUDE.md`'s own "canonical spec
documents" table — read `CLAUDE.md` itself first for the current list, since
it's the single source of truth and this skill file will drift out of sync
with it over time:
`docs/canon/README.md`, `WORLD_VISION.md`, `BRAND_BOOK.md`,
`docs/canon/PEDAGOGY.md`, `AGENT_RULEBOOK.md`, `DASHBOARD_NOTEBOOK_SPEC.md`,
`FABLE5_VISION.md`, `CODEX_BRIEF.md`, plus `CLAUDE.md` and `README.md`
themselves.

Also treat as live unless proven otherwise: anything referenced from
`CLAUDE.md`'s "Active workstream" section, anything the most recent
`NEXT_SESSION.md` (or equivalent handoff doc) points to, and anything
`git log -3 -- <file>` shows a commit in the last ~2 weeks touching.

## Process

1. **Inventory candidates.** For docs: `ls *.md` at the repo root (and any
   other suspiciously flat directory of one-off docs). For code: look for
   files/functions nothing calls — `grep -rn` the symbol name across the
   repo excluding `node_modules`/`.git`/build output.
2. **Cross-reference each candidate**, in this order (cheapest checks first):
   - Is it in the "never delete" list above? Stop, keep it.
   - `grep -rln "<filename-without-extension>"` across the repo (excluding
     `node_modules`, `.git`, lockfiles) — is anything still pointing at it?
   - Does its own content contain staleness signals — a date, "DONE",
     "shipped", "superseded by X", "completed", or is it a `_V2`/`_v2` file
     implying a same-named `_V1` sibling is now stale?
   - Does `git log -5 --oneline -- <file>` show recent, active edits, or is
     the last touch old and one-shot (created and never revisited)?
   - For code: is the symbol/file reachable from any real UI action, route,
     or entry point, or does it only exist in dead branches (an `if false`,
     a switch case that's never hit, a state flag nothing ever sets)? The
     `showDocCook`/`TestInstanceView` and `DeskShellView.launchBoundInstance`
     `.testCook` cases (documented in `CLAUDE.md`'s iOS section) are the
     reference example of this: fully-built, zero real trigger, confirmed by
     grepping for every place the presenting flag is set.
3. **Classify each candidate**: `KEEP` (referenced or recently active),
   `DELETE-CANDIDATE` (no references found, clearly historical/superseded),
   or `UNCERTAIN` (ambiguous — ask the user rather than guess). Err toward
   `UNCERTAIN` when a file could plausibly still matter; the cost of asking
   is low, the cost of deleting a live reference is a confused future
   session with no way to know what happened.
4. **Report the classification before deleting anything** unless the user
   has already given blanket permission for this specific pass (e.g. "delete
   useless stuff, I trust your judgment" said in the current conversation).
   Even then, list what you're about to remove in the commit message so it's
   auditable.
5. **Delete via `git rm`, not `rm`**, so the removal is a normal tracked
   commit (fully recoverable via `git log`/`git show` later, unlike a
   filesystem delete). Batch the deletion into one commit with a clear
   message listing what was removed and why — don't bury it inside an
   unrelated feature commit.
6. **For dead code** (not docs): remove the unreachable code itself, not
   just flag it. Don't leave commented-out blocks or `// unused` markers —
   per this project's own conventions (see `CLAUDE.md`/root instructions),
   if something is confirmed unused, delete it outright rather than leaving
   a backwards-compatibility shim.

## What this is not

Not a license to restructure working, tested code "while you're in there."
A hygiene pass removes things that are already dead (nothing points at
them); it doesn't refactor things that are alive just because they could be
cleaner. If a file is `KEEP` but genuinely messy, that's a separate,
explicitly-scoped refactor conversation — note it, don't do it inline here.
