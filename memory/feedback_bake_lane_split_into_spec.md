---
name: feedback-bake-lane-split-into-spec
description: Label the owning lane and exact file paths inside the spec itself — don't ask about splitting afterward
metadata:
  type: feedback
---

Every build file must include lane ownership in the header and on each section:
- **Lane A** = `ml/**` (Python engine, FastAPI, firestore_adapter)
- **Lane B** = `app/**` (React frontend, data files, TypeScript)
- **Lane C** = `webhook/**` (Vercel serverless functions)

**Why:** Asking "how should we split this?" after writing the spec creates a round-trip that slows down implementation and can lead to agents touching the same files.

**How to apply:** Before writing any spec section, label it `[Lane A]`, `[Lane B]`, or `[Lane C]`. Put file paths in backtick paths so agents know exactly which files they own. The contracts section (shared interfaces between lanes) should always come first.
