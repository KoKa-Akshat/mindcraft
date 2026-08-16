#!/bin/bash
cd "$(dirname "$0")"
python3 -c "
import json
books = json.load(open('../desk_os/workflows/archive/books.json'))['books']
for b in books:
    print(b['slug'] + '\t' + b['url'])
" > _book_list.tsv
total=$(wc -l < _book_list.tsv)
i=0
while IFS=$'\t' read -r slug url; do
  i=$((i+1))
  echo "[$i/$total] $slug"
  python3 mirror_book.py "$slug" "$url" >> mirror_run.log 2>&1
done < _book_list.tsv
echo "DONE — all $total books mirrored" >> mirror_run.log
