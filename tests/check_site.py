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
walkthroughs = pages["walkthroughs.html"]
route_pages = {name for name, page in pages.items() if "pickup-index" in page.ids}
assert len(route_pages) == 18
assert {"full-runs", "character-routes", "finale-routes"} <= walkthroughs.ids.keys()
assert {(name, anchor) for name in route_pages for anchor in ("", "pickup-index")} <= walkthroughs.page_links
assert ("walkthroughs.html", "") in home.page_links & endings.page_links & chapters.page_links
story_paths = pages["story-paths.html"]
assert {"prologue", "tape-checkpoints", "optional-pickups", *(f"chapter-{n}" for n in range(1, 11))} <= story_paths.ids.keys()
assert {f"tape-{n}" for n in range(1, 16)} == {anchor for anchor in story_paths.ids if re.fullmatch(r"tape-\d+", anchor)}
assert {("story-paths.html", f"tape-{n}") for n in range(1, 16)} <= reference.page_links
assert {("reference.html", f"path-{n}") for n in range(1, 16)} <= story_paths.page_links
assert ("story-paths.html", "") in home.page_links & walkthroughs.page_links
assert ("completion.html", "pickup-index") in story_paths.page_links
search_route_options = (root / "index.html").read_text(encoding="utf-8").split('id="search-route"', 1)[1].split("</select>", 1)[0]
assert set(re.findall(r'<option value="([^"]+\.html)"', search_route_options)) == route_pages
pickup_pattern = r"(clue-[cfh]\d+|tarot-\d+|evidence-\d+)"
collectible_html = (root / "collectibles.html").read_text(encoding="utf-8")
route_backlinks = set()
for item, links in re.findall(r'<li class="collectible" id="item-([a-z]\d+)"(?:(?!</li>).)*?<p class="pickup-video">([^\r\n]+?)</p>', collectible_html, re.S):
    kind = {"t": "tarot", "e": "evidence"}.get(item[0], "clue")
    step = f"{kind}-{item if kind == 'clue' else item[1:]}"
    for page, anchor in re.findall(r'href="([^"#]+\.html)#' + pickup_pattern + r'"', links):
        if page in route_pages:
            assert anchor == step, (item, page, anchor)
            route_backlinks.add((page, anchor))
assert route_backlinks == {(page, anchor) for page in route_pages for anchor in pages[page].ids if re.fullmatch(pickup_pattern, anchor)}

tarot_route = pages["tarot-route.html"]
assert {"setup", "replay", "pickup-index", "prologue", *(f"chapter-{n}" for n in range(1, 11))} <= tarot_route.ids.keys()
assert {f"tarot-{n}" for n in range(1, 23)} == {key for key in tarot_route.ids if key.startswith("tarot-")}
assert {("collectibles.html", f"item-t{n}") for n in range(1, 23)} <= tarot_route.page_links
assert {("rough-night.html", f"tarot-{n}") for n in range(1, 23)} <= tarot_route.page_links
assert ("tarot-route.html", "replay") in achievements.page_links & collectibles.page_links
tarot_route_html = (root / "tarot-route.html").read_text(encoding="utf-8")
tarot_counts = [(int(total), section.count('id="tarot-')) for total, section in
                re.findall(r'· (\d+) of 22 after this (?:chapter|pickup)</p>(.*?)</section>', tarot_route_html, re.S)]
assert len(tarot_counts) == 11
assert [total for total, _ in tarot_counts] == [sum(count for _, count in tarot_counts[:n]) for n in range(1, 12)]

evidence_route = pages["evidence-route.html"]
assert {"setup", "replay", "pickup-index", "podcast", *(f"chapter-{n}" for n in range(1, 11))} <= evidence_route.ids.keys()
assert {f"evidence-{n}" for n in range(1, 11)} == {key for key in evidence_route.ids if key.startswith("evidence-")}
assert {("collectibles.html", f"item-e{n}") for n in range(1, 11)} <= evidence_route.page_links
assert {("rough-night.html", f"evidence-{n}") for n in range(1, 11)} <= evidence_route.page_links
assert ("evidence-route.html", "replay") in achievements.page_links & collectibles.page_links & pages["newspapers.html"].page_links
evidence_route_html = (root / "evidence-route.html").read_text(encoding="utf-8")
assert re.findall(r'id="chapter-(\d+)">\s*<p class="eyebrow">Chapter (\d+) · (\d+) of 10</p>(?:(?!</section>).)*?id="evidence-(\d+)"',
                  evidence_route_html, re.S) == [(str(n),) * 4 for n in range(1, 11)]

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
for route in ("rough-night", "massacre", "blood-pact", "finale", "alternate-endings", "completion", "newspapers", "abi-nick-routes", "dylan-routes", "emma-routes", "jacob-routes", "kaitlyn-routes"):
    page = pages[f"{route}.html"]
    assert {"pickup-index", "route-item"} <= page.ids.keys()
    assert "pickup-index" in page.anchors
    assert ("collectibles.html", "collectibles") in page.page_links
assert rough_night.list_items["route-counselors"] == 9
assert rough_night.list_items["route-checkpoints"] == 13
assert ("rough-night.html", "route-checklist") in endings.page_links
recoveries = {f"recover-{scene}" for scene in ("woods", "emma", "jacob", "jail", "van", "cages", "attic", "lodge", "car", "nest")}
assert {"recover", "lodge-call", *recoveries} <= rough_night.ids.keys()
assert {"recover", *recoveries} <= set(rough_night.anchors)
assert ("rough-night.html", "recover") in endings.page_links
for kind, prefix, count in (("tarot", "t", 22), ("evidence", "e", 10)):
    for number in range(1, count + 1):
        assert f"{kind}-{number}" in rough_night.ids
        assert ("collectibles.html", f"item-{prefix}{number}") in rough_night.page_links
        assert ("rough-night.html", f"{kind}-{number}") in collectibles.page_links

massacre = pages["massacre.html"]
assert {"setup", "final-girl-rabbit", "final-girl-no-rabbit", "ticket-setup", "jacob-pickups", *(f"chapter-{chapter}" for chapter in range(4, 11))} <= massacre.ids.keys()
for survivor in sole_survivors:
    assert survivor in massacre.ids and ("massacre.html", survivor) in endings.page_links
for kind, prefix, numbers in (("tarot", "t", range(6, 23)), ("evidence", "e", range(4, 11))):
    assert {key for key in massacre.ids if key.startswith(kind + "-")} == {f"{kind}-{number}" for number in numbers}
    assert {("collectibles.html", f"item-{prefix}{number}") for number in numbers} <= massacre.page_links
    assert {("massacre.html", f"{kind}-{number}") for number in numbers} <= collectibles.page_links
massacre_clues = {f"{prefix}{number}" for prefix, start, end in (("c", 8, 12), ("f", 7, 9), ("h", 6, 19)) for number in range(start, end + 1)}
assert {key for key in massacre.ids if re.fullmatch(r"clue-[cfh]\d+", key)} == {f"clue-{key}" for key in massacre_clues}
assert {("massacre.html", f"clue-{key}") for key in massacre_clues} <= collectibles.page_links
assert {("collectibles.html", f"item-{key}") for key in massacre_clues} <= massacre.page_links

blood_pact = pages["blood-pact.html"]
assert {"setup", "prologue", "both-crane-bites", "mutually-assured", "epilogue", *(f"chapter-{chapter}" for chapter in range(1, 11))} <= blood_pact.ids.keys()
clues = {f"{prefix}{number}" for prefix, count in (("c", 12), ("f", 9), ("h", 19)) for number in range(1, count + 1)}
assert {"all-clues-plan", "ticket-setup", "amputation-branch"} <= rough_night.ids.keys()
assert {key for key in rough_night.ids if re.fullmatch(r"clue-[cfh]\d+", key)} == {f"clue-{key}" for key in clues}
assert {("rough-night.html", f"clue-{key}") for key in clues} <= collectibles.page_links
assert {("collectibles.html", f"item-{key}") for key in clues} <= rough_night.page_links
assert ("rough-night.html", "all-clues-plan") in achievements.page_links & endings.page_links & walkthroughs.page_links
pickups = {f"clue-{key}": f"item-{key}" for key in clues}
pickups.update({f"tarot-{number}": f"item-t{number}" for number in range(1, 23) if number != 3})
pickups.update({f"evidence-{number}": f"item-e{number}" for number in range(1, 11)})
assert pickups.keys() <= blood_pact.ids.keys() and "tarot-3" not in blood_pact.ids
for route_anchor, item in pickups.items():
    assert ("blood-pact.html", route_anchor) in collectibles.page_links
    assert ("collectibles.html", item) in blood_pact.page_links

blood_pact_html = (root / "blood-pact.html").read_text(encoding="utf-8")
clue_checkpoint_table = blood_pact_html.split('id="clue-checkpoints"', 1)[1].split("</table>", 1)[0]
clue_rows = re.findall(r'<tr><th scope="row"><a href="#([^"]+)">[^<]+</a></th><td>(\d+)</td><td>(\d+)</td></tr>', clue_checkpoint_table)
assert [anchor for anchor, *_ in clue_rows] == ["prologue", *(f"chapter-{n}" for n in range(1, 11))]
clues_so_far = set()
for chapter, (anchor, early, recovered) in enumerate(clue_rows):
    section = blood_pact_html.split(f'id="{anchor}">', 1)[1].split("</section>", 1)[0]
    clues_so_far.update(re.findall(r'id="clue-([cfh]\d+)"', section))
    assert int(early) == len(clues_so_far)
    assert int(recovered) == len(clues_so_far) - (3 if 1 <= chapter <= 4 else 0)
assert clues_so_far == clues

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
alternate_routes = {"save-caleb", "spare-chris", "caleb-with-chris", "silas-spared", "teens-acquitted"}
assert alternate_routes | {"setup", "chapter-9", "dylan-freezer", "rabbit-rescue", "laura-captured", "skip-chapter-10", "scrap"} <= alternate.ids.keys()
assert {("alternate-endings.html", route) for route in alternate_routes} <= endings.page_links
for kind, prefix, numbers in (("tarot", "t", range(18, 23)), ("evidence", "e", (9, 10))):
    assert {("alternate-endings.html", f"{kind}-{number}") for number in numbers} <= collectibles.page_links
    assert {("collectibles.html", f"item-{prefix}{number}") for number in numbers} <= alternate.page_links
assert {("epilogue.html", headline) for headline in ("closing-shooting-self-defense", "closing-case-reopens")} <= alternate.page_links

early_epilogue = pages["early-epilogue.html"]
assert {"setup", "delay-jacob", "radio-bite", "jacob-pickups", "van-abi", "van-dylan", "scrap", "attic", "epilogue", *(f"chapter-{chapter}" for chapter in range(4, 10))} <= early_epilogue.ids.keys()
assert ("early-epilogue.html", "setup") in endings.page_links & alternate.page_links & walkthroughs.page_links
early_pickups = {f"clue-{key}": f"item-{key}" for key in massacre_clues - {"c12", "f9", "h17", "h18", "h19"}}
early_pickups.update({f"tarot-{number}": f"item-t{number}" for number in range(6, 22)})
early_pickups.update({f"evidence-{number}": f"item-e{number}" for number in range(4, 10)})
assert early_pickups.keys() == {key for key in early_epilogue.ids if re.fullmatch(r"(?:clue-[cfh]|tarot-|evidence-)\d+", key)}
assert {("collectibles.html", item) for item in early_pickups.values()} <= early_epilogue.page_links
assert {("early-epilogue.html", step) for step in early_pickups} <= collectibles.page_links

completion = pages["completion.html"]
assert {"setup", "quick-starts", "prologue", "epilogue", "replays", "manual-combat", "pickup-checkpoints", "all-clues-plan", "table-shot",
        *(f"chapter-{chapter}" for chapter in range(1, 11))} <= completion.ids.keys()
assert {("completion.html", anchor) for anchor in ("setup", "replays", "manual-combat")} <= achievements.page_links
assert ("completion.html", "pickup-checkpoints") in achievements.page_links & walkthroughs.page_links
assert ("completion.html", "all-clues-plan") in achievements.page_links
completion_pickups = {f"clue-{key}": f"item-{key}" for key in clues}
for kind, prefix, count in (("tarot", "t", 22), ("evidence", "e", 10)):
    completion_pickups.update({f"{kind}-{number}": f"item-{prefix}{number}" for number in range(1, count + 1)})
assert completion_pickups.keys() == {key for key in completion.ids if re.fullmatch(r"(?:clue-[cfh]|tarot-|evidence-)\d+", key)}
assert {("collectibles.html", item) for item in completion_pickups.values()} <= completion.page_links
assert {("completion.html", anchor) for anchor in completion_pickups} <= collectibles.page_links
assert completion.list_items["completion-replay-list"] == 4
achievement_replays = pages["achievement-replays.html"]
replay_stages = {"reunions", "massacre", "final-girl", "last-man-standing", "blood-pact"}
assert replay_stages | {"setup", "single-awards"} <= achievement_replays.ids.keys()
assert {("achievement-replays.html", stage) for stage in replay_stages} <= completion.page_links & achievements.page_links
assert ("achievement-replays.html", "") in walkthroughs.page_links & reference.page_links
assert {("blood-pact.html", "clue-checkpoints"), ("massacre.html", "final-girl-rabbit"),
        ("massacre.html", "final-girl-no-rabbit"), ("massacre.html", "last-man-standing")} <= achievement_replays.page_links

completion_html = (root / "completion.html").read_text(encoding="utf-8")
checkpoint_table = completion_html.split('id="pickup-checkpoints"', 1)[1].split("</table>", 1)[0]
checkpoint_rows = re.findall(r'<tr><th scope="row"><a href="#([^"]+)">[^<]+</a></th><td>([^<]+)</td><td>(\d+)</td><td>([^<]+)</td></tr>', checkpoint_table)
assert [anchor for anchor, *_ in checkpoint_rows] == ["prologue", *(f"chapter-{chapter}" for chapter in range(1, 11))]
collected = set()
for chapter, (anchor, tarot, evidence, clue) in enumerate(checkpoint_rows):
    section = completion_html.split(f'id="{anchor}">', 1)[1].split("</section>", 1)[0]
    collected.update(re.findall(r'id="((?:clue-[cfh]|tarot-|evidence-)\d+)"', section))
    cards, items, names = (sum(key.startswith(kind) for key in collected) for kind in ("tarot-", "evidence-", "clue-"))
    assert int(evidence) == items, anchor
    assert tarot == (str(cards) if chapter < 2 else f"{cards} / {cards - 1}"), anchor
    # Shady Glade moves the Trail Camera pickup from Chapter 3 to Chapter 2.
    assert clue == (str(names) if chapter < 2 else f"{names - 1} / {names + (chapter == 2)}"), anchor

epilogue = pages["epilogue.html"]
hackett_silas_routes = pages["hackett-silas-routes.html"]
assert {"setup", "pickup-index", "early-setup", "chapter-9", "caleb-setup", "chapter-10",
        "silver", "freezer", "hunt", "family-matters", "eliza"} <= hackett_silas_routes.ids.keys()
for name, anchors in (
    ("bobby", ("bobby-spared", "bobby-stabbed")),
    ("caleb", ("woods-caleb", "caleb-cured", "joint-freezer", "trap-caleb", "caleb-dawn", "woods-caleb",
               "joint-freezer", "caleb-kills-kaitlyn", "silver-both", "silver-abi", "trap-caleb",
               "silver-emma", "caleb-kills-kaitlyn")),
    ("chris", ("chris-alive", "chris-snare", "chris-dead")),
    ("constance", ("bobby-spared", "constance-shot", "bobby-stabbed")),
    ("jedediah", ("bobby-spared", "jedediah-attack", "bobby-stabbed")),
    ("kaylee", ("kaylee",)),
    ("silas", ("white-wolf-alive", "silas-spared", "silas-nest", "silas-crash")),
):
    assert {("epilogue.html", f"card-{name}-{number}") for number in range(1, len(anchors) + 1)} <= hackett_silas_routes.page_links
    assert {("hackett-silas-routes.html", anchor) for anchor in anchors} <= epilogue.page_links
assert ("hackett-silas-routes.html", "eliza") in epilogue.page_links
assert {("hackett-silas-routes.html", anchor) for anchor in ("", "family-matters", "hunt")} <= endings.page_links
assert {("hackett-silas-routes.html", anchor) for anchor in ("family-matters", "silas-nest", "silas-crash")} <= achievements.page_links
for kind, short, numbers in (("tarot", "t", range(18, 23)), ("evidence", "e", (9, 10))):
    assert {("hackett-silas-routes.html", f"{kind}-{number}") for number in numbers} <= collectibles.page_links
    assert {("collectibles.html", f"item-{short}{number}") for number in numbers} <= hackett_silas_routes.page_links

ryan_travis_routes = pages["ryan-travis-routes.html"]
assert {"setup", "pickup-index", "attic", *(f"chapter-{chapter}" for chapter in (3, 4, 5, 7, 8, 9, 10))} <= ryan_travis_routes.ids.keys()
for name, anchors in (
    ("ryan", ("nest-shot", "vial-survival", "shoot-travis", "bleed-out", "mutual", "crash",
              "travis-shoots", "nest-death", "bobby-kills", "two-shot-bleed-out")),
    ("travis", ("nest-shot", "capture", "shoot-laura", "travis-shoots", "nest-travis-shot",
                "mutual", "shoot-travis", "crash", "nest-death", "nest-travis-ground", "reunion")),
):
    assert {("epilogue.html", f"card-{name}-{number}") for number in range(1, len(anchors) + 1)} <= ryan_travis_routes.page_links
    assert {("ryan-travis-routes.html", anchor) for anchor in anchors} <= epilogue.page_links
assert ("ryan-travis-routes.html", "") in endings.page_links
assert {("ryan-travis-routes.html", anchor) for anchor in ("attic", "mutual", "bite", "shoot-travis")} <= achievements.page_links
for kind, short, numbers in (("tarot", "t", (6, 8, 9, *range(12, 20), 21, 22)), ("evidence", "e", (5, 7, 8, 9, 10))):
    assert {("ryan-travis-routes.html", f"{kind}-{number}") for number in numbers} <= collectibles.page_links
    assert {("collectibles.html", f"item-{short}{number}") for number in numbers} <= ryan_travis_routes.page_links

laura_max_routes = pages["laura-max-routes.html"]
assert {"setup", "pickup-index", "prologue", "chapter-3", "chapter-4", "chapter-7", "chapter-8",
        "chapter-9", "chapter-10", "hunt"} <= laura_max_routes.ids.keys()
for name, anchors in (
    ("laura", ("nest-shot", "island-reunion", "vial-survival", "capture", "crash-shot",
               "crash-death", "revenge", "mutual", "nest-death", "shoot-laura")),
    ("max", ("stay", "wait-laura", "island-reunion", "max-infected", "swim")),
):
    assert {("epilogue.html", f"card-{name}-{number}") for number in range(1, len(anchors) + 1)} <= laura_max_routes.page_links
    assert {("laura-max-routes.html", anchor) for anchor in anchors} <= epilogue.page_links
assert ("laura-max-routes.html", "") in endings.page_links
assert ("laura-max-routes.html", "island-reunion") in achievements.page_links
for kind, short, numbers in (("tarot", "t", (1, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22)),
                             ("evidence", "e", (4, 7, 8, 9, 10))):
    assert {("laura-max-routes.html", f"{kind}-{number}") for number in numbers} <= collectibles.page_links
    assert {("collectibles.html", f"item-{short}{number}") for number in numbers} <= laura_max_routes.page_links

abi_nick_routes = pages["abi-nick-routes.html"]
assert {f"chapter-{chapter}" for chapter in (1, 2, 3, 5, 6, 8, 9, 10)} <= abi_nick_routes.ids.keys()
for name, count in (("abi", 5), ("nick", 4)):
    assert {("epilogue.html", f"card-{name}-{number}") for number in range(1, count + 1)} <= abi_nick_routes.page_links
assert ("abi-nick-routes.html", "") in endings.page_links
assert {("abi-nick-routes.html", anchor) for anchor in ("pool-shot", "rescue")} <= achievements.page_links
for kind, short, numbers in (("tarot", "t", (3, 5, 11, 14, 17, 21, 22)), ("evidence", "e", (1, 10))):
    assert {f"{kind}-{number}" for number in numbers} <= abi_nick_routes.ids.keys()
    assert {("abi-nick-routes.html", f"{kind}-{number}") for number in numbers} <= collectibles.page_links
    assert {("collectibles.html", f"item-{short}{number}") for number in numbers} <= abi_nick_routes.page_links
dylan_routes = pages["dylan-routes.html"]
assert {f"chapter-{chapter}" for chapter in (1, 4, 5, 8, 9, 10)} <= dylan_routes.ids.keys()
assert {("epilogue.html", f"card-dylan-{number}") for number in range(1, 25)} <= dylan_routes.page_links
assert ("dylan-routes.html", "") in endings.page_links
for kind, short, numbers in (("tarot", "t", (6, 8, 9, 20, 21, 22)), ("evidence", "e", (5, 10))):
    assert {f"{kind}-{number}" for number in numbers} <= dylan_routes.ids.keys()
    assert {("dylan-routes.html", f"{kind}-{number}") for number in numbers} <= collectibles.page_links
    assert {("collectibles.html", f"item-{short}{number}") for number in numbers} <= dylan_routes.page_links
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
kaitlyn_routes = pages["kaitlyn-routes.html"]
assert {"early-setup", "chapter-8", "chapter-9", "chapter-10"} <= kaitlyn_routes.ids.keys()
assert {("epilogue.html", f"card-kaitlyn-{number}") for number in range(1, 38)} <= kaitlyn_routes.page_links
assert ("kaitlyn-routes.html", "") in endings.page_links
for kind, short, numbers in (("tarot", "t", range(14, 23)), ("evidence", "e", range(8, 11))):
    assert {f"{kind}-{number}" for number in numbers} <= kaitlyn_routes.ids.keys()
    assert {("kaitlyn-routes.html", f"{kind}-{number}") for number in numbers} <= collectibles.page_links
    assert {("collectibles.html", f"item-{short}{number}") for number in numbers} <= kaitlyn_routes.page_links
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
