from collections import Counter
from html.parser import HTMLParser
from pathlib import Path


class Guide(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = Counter()
        self.entries = Counter()
        self.items = Counter()
        self.anchors = set()
        self.files = set()

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if "id" in attrs:
            self.ids[attrs["id"]] += 1
        if "data-search" in attrs:
            self.entries[attrs["data-search"]] += 1
        if "data-type" in attrs:
            self.items[attrs["data-type"]] += 1
        href = attrs.get("href", "")
        if href.startswith("#"):
            self.anchors.add(href[1:])
        if tag == "label" and "for" in attrs:
            self.anchors.add(attrs["for"])
        if href.startswith("assets/"):
            self.files.add(href)
        if tag in ("img", "script"):
            self.files.add(attrs["src"])


root = Path(__file__).resolve().parents[1]
guide = Guide()
guide.feed((root / "index.html").read_text(encoding="utf-8"))
assert not [key for key, count in guide.ids.items() if count != 1], "Duplicate IDs"
assert not guide.anchors - guide.ids.keys(), guide.anchors - guide.ids.keys()
assert all((root / name).is_file() for name in guide.files), "Missing asset"
assert guide.items == {"clue": 40, "evidence": 10, "tarot": 22}, guide.items
assert guide.entries["Achievement"] == 41, guide.entries
assert guide.entries["Walkthrough"] == 12, guide.entries
assert guide.entries["Story path"] == 15, guide.entries
print("Guide counts, anchors, and assets verified.")
