"""OpenStax ingestion must never admit NonCommercial content.

209 CC BY-NC-SA rows (Contemporary Mathematics) reached the shipped commercial
bundle because the adapter gated on subject rather than licence and documented
the whole API as "CC-BY". These tests pin the licence gate so that cannot
silently regress.

Licences were verified per-slug against the OpenStax CMS API on 2026-08-17:
    https://openstax.org/apps/cms/api/v2/pages/
        ?type=books.Book&slug=<slug>&fields=license_name
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

_PIPELINE = Path(__file__).parents[1] / "scripts" / "pipeline"
sys.path.insert(0, str(_PIPELINE))
sys.path.insert(0, str(_PIPELINE / "sources"))

from openstax import (  # noqa: E402
    CC_BY_BOOK_TOKENS,
    EXCLUDED_NC_BOOK_TOKENS,
    OpenStaxAdapter,
)

# Every slug that is CC BY-NC-SA. Adding any of these to CC_BY_BOOK_TOKENS
# would reintroduce the contamination.
KNOWN_NC_SLUGS = {
    "contemporary-mathematics",
    "algebra-1",
    "calculus-volume-1",
    "calculus-volume-2",
    "calculus-volume-3",
    "prealgebra-2e",
    "elementary-algebra-2e",
    "intermediate-algebra-2e",
    "college-algebra-2e",
    "precalculus-2e",
    "algebra-and-trigonometry-2e",
    "introductory-statistics-2e",
    "introductory-business-statistics-2e",
    "college-algebra-corequisite-support-2e",
}


def test_no_noncommercial_book_is_in_the_allowlist() -> None:
    assert not (CC_BY_BOOK_TOKENS & KNOWN_NC_SLUGS)


def test_allowlist_and_exclusions_are_disjoint() -> None:
    assert not (CC_BY_BOOK_TOKENS & EXCLUDED_NC_BOOK_TOKENS)


def test_every_known_nc_slug_is_explicitly_excluded() -> None:
    """Exclusions are listed, not merely omitted, so the reason stays visible."""
    assert KNOWN_NC_SLUGS <= EXCLUDED_NC_BOOK_TOKENS


@pytest.mark.parametrize("slug", sorted(KNOWN_NC_SLUGS))
def test_noncommercial_items_are_rejected(slug: str) -> None:
    assert OpenStaxAdapter._is_math_book([f"book-slug:{slug}"]) is False


@pytest.mark.parametrize("slug", sorted(CC_BY_BOOK_TOKENS))
def test_cc_by_items_are_accepted(slug: str) -> None:
    assert OpenStaxAdapter._is_math_book([f"book-slug:{slug}"]) is True


def test_dual_tagged_item_does_not_launder_nc_terms() -> None:
    """An item tagged with both a clean and an NC book inherits the NC terms.

    Items really are dual-tagged in this corpus, so this is the realistic
    path by which NC content would slip through a naive any-match gate.
    """
    tags = ["book-slug:precalculus", "book-slug:contemporary-mathematics"]
    assert OpenStaxAdapter._is_math_book(tags) is False


def test_book_namespace_alone_is_not_sufficient() -> None:
    """`book:stax-*` carries no verified licence mapping, so it cannot admit."""
    assert OpenStaxAdapter._is_math_book(["book:stax-cmath"]) is False
    assert OpenStaxAdapter._is_math_book(["book:stax-calgebra"]) is False


def test_untagged_item_is_rejected() -> None:
    assert OpenStaxAdapter._is_math_book([]) is False
    assert OpenStaxAdapter._is_math_book(["assignment-type:reading"]) is False
