# Past Paper Intake Folder

Place only PDFs that MindCraft is allowed to process here.

Do not commit copyrighted exam PDFs. The ingestion script reads local files and
writes derived JSONL records to `ml/data/past_paper_index/`.

Recommended layout:

```text
ml/data/past_papers/
  IB_AI_SL/
    2023-may-paper-1.pdf
    2023-may-paper-2.pdf
```

Derived data should store patterns and metadata, not copied full papers.
