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
        self.list_ids = []
        self.list_items = Counter()

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
        if tag in ("ol", "ul"):
            self.list_ids.append(attrs.get("id"))
        if tag == "li" and self.list_ids and self.list_ids[-1]:
            self.list_items[self.list_ids[-1]] += 1
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

    def handle_endtag(self, tag):
        if tag in ("ol", "ul"):
            self.list_ids.pop()


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
assert {
    "sole-abi", "sole-dylan", "sole-emma", "sole-jacob", "final-girl",
    "sole-laura", "sole-max", "sole-nick", "last-man-standing",
} <= guide.ids.keys()
assert guide.list_items == {"score-tracks": 30, "licensed-tracks": 7, "library-tracks": 31, "podcast-episodes": 6}, guide.list_items
epilogue = pages["epilogue.html"]
assert len(epilogue.characters) == 17, epilogue.characters
assert epilogue.fates == {"alive": 44, "infected": 29, "dead": 70}, epilogue.fates
assert epilogue.list_items["podcast-evidence-order"] == 10, epilogue.list_items
assert epilogue.list_items["headline-asset-intros"] == 14, epilogue.list_items
assert epilogue.list_items["headline-asset-outros"] == 21, epilogue.list_items
print("Guide counts, anchors, and assets verified.")
