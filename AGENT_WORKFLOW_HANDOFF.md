MindCraft — handoff for Cursor
Repo, branch, remote
One repo, one remote: https://github.com/KoKa-Akshat/mindcraft.git
Everyone works on main directly. No feature branches in this workflow — commits land on main and CI deploys immediately.
Two local checkouts of this same repo exist on this machine: /Users/akoirala/Developer/mindcraft (the live one — this is where all real work should happen) and /Users/akoirala/Desktop/Business Ideas/mindcraft-site (a stale second checkout, tens of commits behind, that has caused real confusion today when an agent worked in it by accident and everything it built never actually shipped until it was manually found and copied over). Always confirm you're in /Users/akoirala/Developer/mindcraft before editing anything — run pwd and git log --oneline -3 first; if pwd shows Desktop/Business Ideas, stop and switch.
How deploys work
git push origin main triggers .github/workflows/deploy.yml, which builds app/ and deploys three Firebase Hosting targets: app (mindcraft-93858.web.app, the dashboard/student app), world1 (mindcraft-world1.web.app, the 3D world static site), marketing (mindcraft-marketing-site.web.app, root-level index.html/blog.html).
Never run firebase deploy locally. It publishes whatever's on your disk and clobbers CI's output, overwriting other people's in-flight work. Push to main and let CI do it.
After every push, confirm the Actions run actually went green (gh run list --branch main --limit 1, gh run view <id>) before considering anything "shipped." Don't just assume a push succeeded.
Client-side app is a single-page app — an already-open browser tab won't pick up a new deploy until a real hard refresh (Cmd+Shift+R) or a fresh tab. This has caused "I don't see my changes" false alarms more than once today.
Lane ownership (read this before touching anything)
Two people's work lives in this same tree, on disjoint trees:

Lane	Owner	Tree
Engine	Blake	ml/**, webhook/**, data/**, worlds/**
Product	Akshat	app/**, index.html, blog.html, root marketing files
There's also a third, currently-in-progress thing: Manjushree — a co-founder's own feature (app/src/manjushree/, app/src/pages/StorySlideshow.tsx, and routes in app/src/App.tsx: /manjushree, /manjushree-dev, /story-loop/:conceptId, /story-loop-dev/:conceptId). This is real, in-progress, and currently sits uncommitted in the working tree — App.tsx has a permanent comment warning that this exact wiring has been lost to concurrent overwrites three separate times today. If you ever need to edit App.tsx, read the whole file first, make your specific change, and never delete or "clean up" anything that looks like dead Manjushree code — it's live WIP, not cruft.

CLAUDE.md at the repo root is the full project brief — concept ontology, ML architecture, deploy details, current gotchas. Worth a real read before diving in; it's kept up to date.

How today's work has actually been happening (the pattern worth matching)
Real bug reports come in as screenshots/descriptions from the person actually using the live product, not spec docs.
Every change gets independently verified before it's called done: npx tsc --noEmit, npx vitest run (current baseline: 120 passed / 1 skipped, 8 files), npm run build, and a real screenshot of the before/after state (a temporary VITE_SCREENSHOT_MODE-gated auth bypass in App.tsx is the established pattern for this, always fully reverted afterward, confirmed via diff).
Never claim something is fixed/shipped without having actually run the check, not just read the code and assumed it would pass.
Commits are scoped precisely — only the files actually relevant to a given fix get staged, never a blind git add -A, specifically so unrelated in-progress work (Manjushree's routes, a concurrent collaborator's edits) never gets swept into someone else's commit by accident.
ACTIVE_TASK.md at the repo root gets a new dated entry after every real batch of work — check the top of that file for the most current state of what's shipped vs. still open before starting anything new.
Current focus (as of this handoff)
Recently shipped and live: a Contents "roadmap" redesign on the dashboard (horizontal line of progress dots per subject lane), a live typed-expression graph box in Practice/chapter question views, all 42 concept chapters given real photo art and expanded stories, a "Find a Tutor" page with a real Google Maps integration and a location field tutors can self-set, a marketing-page overhaul (hero, a "Sword of Wisdom" demo panel leading with a real product preview, a tutor-recruitment section separated from an honest "reviews coming soon" placeholder).

Still being worked on right now (in progress as this doc is written): fixing a caption-rendering bug in practice questions, fixing a graph-box-shows-the-wrong-thing bug, investigating a story-pagination issue on a handful of concepts, shortening the recently-expanded concept stories back down, some dashboard hero-bar layout tweaks, and a tabbed apply-for-seat/apply-to-tutor form on the marketing page.