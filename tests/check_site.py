from collections import Counter
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
import json
import re


class Guide(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = Counter()
        self.entries = Counter()
        self.items = Counter()
        self.clue_groups = Counter()
        self.pickup_times = Counter()
        self.fates = Counter()
        self.recaps = Counter()
        self.recap_alts = Counter()
        self.characters = set()
        self.anchors = set()
        self.files = set()
        self.newspapers = Counter()
        self.headline_openings = Counter()
        self.page_links = set()
        self.list_ids = []
        self.list_items = Counter()
        self.anchored_list_items = Counter()

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if "id" in attrs:
            self.ids[attrs["id"]] += 1
        if "data-search" in attrs:
            self.entries[attrs["data-search"]] += 1
        if "data-type" in attrs:
            self.items[attrs["data-type"]] += 1
        if attrs.get("data-type") == "clue":
            self.clue_groups[attrs.get("data-clue-group")] += 1
        if "data-fate" in attrs:
            self.fates[attrs["data-fate"]] += 1
        if "data-recap" in attrs:
            self.recaps[attrs["data-recap"]] += 1
        if "data-recap-alt" in attrs:
            self.recap_alts[attrs["data-recap-alt"]] += 1
        if "data-character" in attrs:
            self.characters.add(attrs["data-character"])
        if tag in ("ol", "ul"):
            self.list_ids.append(attrs.get("id"))
        if tag == "li" and self.list_ids and self.list_ids[-1]:
            self.list_items[self.list_ids[-1]] += 1
            if attrs.get("id"):
                self.anchored_list_items[self.list_ids[-1]] += 1
        href = attrs.get("href", "")
        pickup = "https://www.youtube.com/watch?v=n7fbCRG1nis&t="
        if href.startswith(pickup):
            seconds = href[len(pickup):-1]
            assert href.endswith("s") and seconds.isdecimal(), href
            self.pickup_times[int(seconds)] += 1
        if href.startswith("#"):
            self.anchors.add(href[1:])
            if href.startswith("#opening-") and self.list_ids and self.list_ids[-1] == "headline-asset-outros":
                self.headline_openings[href[1:]] += 1
        elif href.startswith("./") or (href.partition("#")[0].endswith(".html") and "://" not in href):
            page, _, anchor = href.partition("#")
            self.page_links.add(("index.html" if page == "./" else page, anchor))
        if tag == "label" and "for" in attrs:
            self.anchors.add(attrs["for"])
        if tag == "option" and attrs.get("value", "").startswith("closing-"):
            self.anchors.add(attrs["value"])
        if href.startswith("assets/"):
            self.files.add(href.partition("?")[0])
        if tag in ("img", "script"):
            self.files.add(attrs["src"].partition("?")[0])
        if tag == "img" and attrs["src"].startswith("assets/newspapers/"):
            self.newspapers[attrs["src"]] += 1

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

home = pages["index.html"]
chapters = pages["chapters.html"]
collectibles = pages["collectibles.html"]
achievements = pages["achievements.html"]
reference = pages["reference.html"]
endings = pages["endings.html"]

legacy = json.loads((root / "assets/guide-anchors.json").read_text(encoding="utf-8"))
assert set(legacy) == {"chapters.html", "collectibles.html", "achievements.html", "reference.html", "endings.html", "characters.html"}
legacy_ids = set()
for name, anchors in legacy.items():
    assert set(anchors) <= pages[name].ids.keys(), name
    assert not legacy_ids.intersection(anchors), name
    assert any(target == name for target, _ in home.page_links), name
    legacy_ids.update(anchors)
assert not legacy_ids.intersection(home.ids), "Moved references should live on their section pages"
assert sum(len(anchors) for anchors in legacy.values()) == len(legacy_ids)
assert collectibles.items == {"clue": 40, "evidence": 10, "tarot": 22}, collectibles.items
assert collectibles.clue_groups == {"camp-history": 12, "freakshow-fire": 9, "hackett-history": 19}, collectibles.clue_groups
assert len(collectibles.pickup_times) == sum(collectibles.pickup_times.values()) == sum(collectibles.items.values()), collectibles.pickup_times
assert {f"vision-{card}" for card in range(1, 23)} <= collectibles.ids.keys()
assert achievements.entries["Achievement"] == 41, achievements.entries
award_section = (root / "achievements.html").read_text(encoding="utf-8").split('id="achievements"', 1)[1].split("</section>", 1)[0]
award_values = re.findall(r"(Bronze|Silver|Gold)\s*·\s*(\d+)G\s*</span>", unescape(award_section))
assert Counter(grade for grade, _ in award_values) == {"Bronze": 29, "Silver": 7, "Gold": 4}, award_values
assert sum(int(score) for _, score in award_values) == 1000, award_values
assert chapters.entries["Walkthrough"] == 12, chapters.entries
assert {f"choices-{chapter}" for chapter in range(11)} <= chapters.ids.keys()
assert chapters.entries["Puzzle"] == 1 and "cage-puzzle" in chapters.ids
assert reference.entries["Story path"] == 15, reference.entries
assert reference.entries["Location"] == 15, reference.entries
sole_survivors = {
    "sole-abi", "sole-dylan", "sole-emma", "sole-jacob", "final-girl",
    "sole-laura", "sole-max", "sole-nick", "last-man-standing",
}
assert sole_survivors <= endings.ids.keys()
assert (reference.list_items + collectibles.list_items) == {
    "score-tracks": 30, "licensed-tracks": 7, "library-tracks": 31, "podcast-episodes": 6,
    "tarot-gallery-cards": 22, "death-art-variants": 8,
    "death-vision-options": 2, "sun-vision-order": 9, "judgement-vision-order": 4,
}, (reference.list_items + collectibles.list_items)
rough_night = pages["rough-night.html"]
assert {"setup", "prologue", "epilogue", *(f"chapter-{chapter}" for chapter in range(1, 11))} <= rough_night.ids.keys()
tarot_order = [1, 2, 3, 5, 4, 7, 6, 8, 9, 10, 11, 13, 12, 15, 16, 14, 17, 18, 19, 20, 21, 22]
gallery = (root / "collectibles.html").read_text(encoding="utf-8").split('id="tarot-gallery-cards"', 1)[1].split("</ul>", 1)[0]
assert [int(number) for number in re.findall(r'href="#item-t(\d+)"', gallery)] == tarot_order
assert [int(key[6:]) for key in rough_night.ids if key.startswith("tarot-")] == tarot_order
for route in ("rough-night", "massacre", "blood-pact", "finale", "alternate-endings", "completion", "newspapers", "emma-routes", "jacob-routes"):
    page = pages[f"{route}.html"]
    assert {"pickup-index", "route-item"} <= page.ids.keys()
    assert "pickup-index" in page.anchors
    assert ("collectibles.html", "collectibles") in page.page_links
assert rough_night.list_items["route-counselors"] == 9
assert rough_night.list_items["route-checkpoints"] == 13
assert ("rough-night.html", "route-checklist") in endings.page_links
for kind, prefix, count in (("tarot", "t", 22), ("evidence", "e", 10)):
    for number in range(1, count + 1):
        assert f"{kind}-{number}" in rough_night.ids
        assert ("collectibles.html", f"item-{prefix}{number}") in rough_night.page_links
        assert ("rough-night.html", f"{kind}-{number}") in collectibles.page_links

massacre = pages["massacre.html"]
assert {"setup", "final-girl-rabbit", "final-girl-no-rabbit", *(f"chapter-{chapter}" for chapter in range(4, 11))} <= massacre.ids.keys()
for survivor in sole_survivors:
    assert survivor in massacre.ids and ("massacre.html", survivor) in endings.page_links
for kind, prefix, numbers in (("tarot", "t", {6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22}), ("evidence", "e", {5, 7, 8, 9, 10})):
    assert {key for key in massacre.ids if key.startswith(kind + "-")} == {f"{kind}-{number}" for number in numbers}
    assert {("collectibles.html", f"item-{prefix}{number}") for number in numbers} <= massacre.page_links
    assert {("massacre.html", f"{kind}-{number}") for number in numbers} <= collectibles.page_links

blood_pact = pages["blood-pact.html"]
assert {"setup", "prologue", "both-crane-bites", "mutually-assured", "epilogue", *(f"chapter-{chapter}" for chapter in range(1, 11))} <= blood_pact.ids.keys()
clues = {f"{prefix}{number}" for prefix, count in (("c", 12), ("f", 9), ("h", 19)) for number in range(1, count + 1)}
pickups = {f"clue-{key}": f"item-{key}" for key in clues}
pickups.update({f"tarot-{number}": f"item-t{number}" for number in range(1, 23) if number != 3})
pickups.update({f"evidence-{number}": f"item-e{number}" for number in range(1, 11)})
assert pickups.keys() <= blood_pact.ids.keys() and "tarot-3" not in blood_pact.ids
for route_anchor, item in pickups.items():
    assert ("blood-pact.html", route_anchor) in collectibles.page_links
    assert ("collectibles.html", item) in blood_pact.page_links

finale = pages["finale.html"]
finale_routes = {
    "motel", "nobodys-fool", "family-matters", "above-the-law", "white-wolf",
    "no-soul-left", "no-soul-headline-replays",
}
assert finale_routes | {"setup", "no-soul-evidence", *(f"chapter-{chapter}" for chapter in range(4, 11))} <= finale.ids.keys()
assert {("finale.html", route) for route in finale_routes} <= endings.page_links | achievements.page_links
for kind, prefix, numbers in (("tarot", "t", range(6, 23)), ("evidence", "e", range(4, 11))):
    assert {("finale.html", f"{kind}-{number}") for number in numbers} <= collectibles.page_links
    assert {("collectibles.html", f"item-{prefix}{number}") for number in numbers} <= finale.page_links

alternate = pages["alternate-endings.html"]
alternate_routes = {"save-caleb", "spare-chris", "caleb-with-chris", "silas-spared", "skip-chapter-10", "teens-acquitted"}
assert alternate_routes | {"setup", "chapter-9", "dylan-freezer", "rabbit-rescue", "laura-captured"} <= alternate.ids.keys()
assert {("alternate-endings.html", route) for route in alternate_routes} <= endings.page_links
for kind, prefix, numbers in (("tarot", "t", range(18, 23)), ("evidence", "e", (9, 10))):
    assert {("alternate-endings.html", f"{kind}-{number}") for number in numbers} <= collectibles.page_links
    assert {("collectibles.html", f"item-{prefix}{number}") for number in numbers} <= alternate.page_links
assert {("epilogue.html", headline) for headline in ("closing-shooting-self-defense", "closing-case-reopens")} <= alternate.page_links

completion = pages["completion.html"]
assert {"setup", "quick-starts", "prologue", "epilogue", "replays", "manual-combat",
        *(f"chapter-{chapter}" for chapter in range(1, 11))} <= completion.ids.keys()
assert {("completion.html", anchor) for anchor in ("setup", "replays", "manual-combat")} <= achievements.page_links
completion_pickups = {f"clue-{prefix}{number}": f"item-{prefix}{number}" for prefix in ("c", "f") for number in range(1, 6)}
for kind, prefix, count in (("tarot", "t", 22), ("evidence", "e", 10)):
    completion_pickups.update({f"{kind}-{number}": f"item-{prefix}{number}" for number in range(1, count + 1)})
assert completion_pickups.keys() <= completion.ids.keys()
assert {("collectibles.html", item) for item in completion_pickups.values()} <= completion.page_links
assert {("completion.html", anchor) for anchor in completion_pickups} <= collectibles.page_links
assert completion.list_items["completion-replay-list"] == 4

epilogue = pages["epilogue.html"]
emma_routes = pages["emma-routes.html"]
assert {f"chapter-{chapter}" for chapter in range(4, 11)} <= emma_routes.ids.keys()
assert {("epilogue.html", f"card-emma-{number}") for number in range(1, 13)} <= emma_routes.page_links
assert ("emma-routes.html", "") in endings.page_links
for kind, short, numbers in (("tarot", "t", range(6, 23)), ("evidence", "e", range(4, 11))):
    assert {f"{kind}-{number}" for number in numbers} <= emma_routes.ids.keys()
    assert {("emma-routes.html", f"{kind}-{number}") for number in numbers} <= collectibles.page_links
    assert {("collectibles.html", f"item-{short}{number}") for number in numbers} <= emma_routes.page_links
jacob_routes = pages["jacob-routes.html"]
assert {f"chapter-{chapter}" for chapter in (1, 3, 4, 6, 8, 9, 10)} <= jacob_routes.ids.keys()
assert {("epilogue.html", f"card-jacob-{number}") for number in range(1, 20)} <= jacob_routes.page_links
assert ("jacob-routes.html", "") in endings.page_links
for kind, short, numbers in (("tarot", "t", (2, 4, 10, 14, 17, 21, 22)), ("evidence", "e", (3, 6))):
    assert {f"{kind}-{number}" for number in numbers} <= jacob_routes.ids.keys()
    assert {("jacob-routes.html", f"{kind}-{number}") for number in numbers} <= collectibles.page_links
    assert {("collectibles.html", f"item-{short}{number}") for number in numbers} <= jacob_routes.page_links
newspapers = pages["newspapers.html"]
headline_routes = dict(re.findall(
    r'<li id="((?:opening|closing)-[^"]+)"[^>]*>[^\n]*?href="newspapers.html#([^"]+)"',
    (root / "epilogue.html").read_text(encoding="utf-8"),
))
assert len(headline_routes) == 35
assert headline_routes.keys() <= epilogue.ids.keys()
assert set(headline_routes.values()) <= newspapers.ids.keys()
assert all(("epilogue.html", headline) in newspapers.page_links for headline in headline_routes)
assert {f"evidence-{number}" for number in range(1, 11)} <= newspapers.ids.keys()
assert ("newspapers.html", "") in endings.page_links and ("newspapers.html", "") in home.page_links
assert {("finale.html", route) for route in ("no-soul-evidence", "no-soul-headline-replays")} <= epilogue.page_links
assert len(epilogue.characters) == 17, epilogue.characters
assert epilogue.fates == {"alive": 62, "infected": 31, "dead": 73}, epilogue.fates
assert sum(epilogue.recaps.values()) == 120, epilogue.recaps
assert sum(epilogue.recap_alts.values()) == 57, epilogue.recap_alts
assert epilogue.recaps + epilogue.recap_alts == {"guide": 159, "file-only": 18}
assert epilogue.list_items["podcast-evidence-order"] == 10, epilogue.list_items
assert epilogue.list_items["headline-asset-intros"] == 14, epilogue.list_items
assert epilogue.list_items["headline-asset-outros"] == 21, epilogue.list_items
for headline_list in ("headline-asset-intros", "headline-asset-outros"):
    assert epilogue.anchored_list_items[headline_list] == epilogue.list_items[headline_list], headline_list
assert len(epilogue.newspapers) == sum(epilogue.newspapers.values()) == 35, epilogue.newspapers
assert epilogue.headline_openings == {
    opening: 2 if opening == "opening-no-soul" else 1
    for opening in epilogue.ids if opening.startswith("opening-")
}, epilogue.headline_openings
print("Guide counts, anchors, and assets verified.")
