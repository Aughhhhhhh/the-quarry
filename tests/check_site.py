from collections import Counter
from html.parser import HTMLParser
from pathlib import Path


class Guide(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = Counter()
        self.entries = Counter()
        self.items = Counter()
        self.fates = Counter()
        self.characters = set()
        self.anchors = set()
        self.files = set()
        self.page_links = set()

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if "id" in attrs:
            self.ids[attrs["id"]] += 1
        if "data-search" in attrs:
            self.entries[attrs["data-search"]] += 1
        if "data-type" in attrs:
            self.items[attrs["data-type"]] += 1
        if "data-fate" in attrs:
            self.fates[attrs["data-fate"]] += 1
        if "data-character" in attrs:
            self.characters.add(attrs["data-character"])
        href = attrs.get("href", "")
        if href.startswith("#"):
            self.anchors.add(href[1:])
        elif href.startswith("./") or (href.partition("#")[0].endswith(".html") and "://" not in href):
            page, _, anchor = href.partition("#")
            self.page_links.add(("index.html" if page == "./" else page, anchor))
        if tag == "label" and "for" in attrs:
            self.anchors.add(attrs["for"])
        if href.startswith("assets/"):
            self.files.add(href)
        if tag in ("img", "script"):
            self.files.add(attrs["src"])


root = Path(__file__).resolve().parents[1]
pages = {}
for path in root.glob("*.html"):
    page = Guide()
    page.feed(path.read_text(encoding="utf-8"))
    assert not [key for key, count in page.ids.items() if count != 1], path
    assert not page.anchors - page.ids.keys(), (path, page.anchors - page.ids.keys())
    assert all((root / name).is_file() for name in page.files), path
    pages[path.name] = page

for page in pages.values():
    for target, anchor in page.page_links:
        assert target in pages and (not anchor or anchor in pages[target].ids), (target, anchor)

guide = pages["index.html"]
assert guide.items == {"clue": 40, "evidence": 10, "tarot": 22}, guide.items
assert {f"vision-{card}" for card in range(1, 23)} <= guide.ids.keys()
assert guide.entries["Achievement"] == 41, guide.entries
assert guide.entries["Walkthrough"] == 12, guide.entries
assert {f"choices-{chapter}" for chapter in range(11)} <= guide.ids.keys()
assert guide.entries["Puzzle"] == 1 and "cage-puzzle" in guide.ids
assert guide.entries["Story path"] == 15, guide.entries
epilogue = pages["epilogue.html"]
assert len(epilogue.characters) == 17, epilogue.characters
assert epilogue.fates == {"alive": 40, "infected": 26, "dead": 54}, epilogue.fates
print("Guide counts, anchors, and assets verified.")
