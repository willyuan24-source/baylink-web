"""Wave-4 lane V Higgsfield prompts (provenance). Writes prompts.json next to this file.

python scripts/opus-sf/assets/w4/prompts.py            -> scripts/opus-sf/assets/w4/prompts.json

Three groups, one style contract (src/opus-bay/ASSETS-LEDGER.md, verbatim):
  landmark concepts (H-1): nano_banana_pro 1:1 2k; variant a = refs K6 + the part-1 rotunda concept with the "match the
    look, make a different building" prefix, variant b = ref K6 only (the recipe of the part-2a landmarks and D2-15).
    Facts behind every subject line are in docs/opus-bay/sf-w4-V.md (Decisions) with their sources.
  vehicle reference sheets (H-4, for lane T; images only, not shipped): nano_banana_pro 16:9 2k, ref K6 (as V1-1).
  T1 map sticker sheet (H-5): nano_banana_pro 1:1 4k, refs K6 + a crop of the painted map v1 (the gouache style of H2b),
    16 round stickers in a 4 x 4 grid in the order of STICKER_IDS (row by row).
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
K6 = "3617006b-483d-4ea7-9e72-39b681f8264f"       # key art K6 (style reference of every whole-SF asset)
ROT = "fba12f36-5e33-435f-9944-be12f183acf9"      # part-1 rotunda concept L2-C1 (SAM-friendly landmark look)
PAPER = "588c24e4-8abb-4ad9-92ac-f98b5283b1a1"    # upload: 1024 crop of public/opus-bay/map/paper-v1-2048.webp

CONTRACT = ("Soft handcrafted miniature diorama, tilt-shift toy photography feel, matte clay and painted wood materials, warm golden-hour "
            "light, gentle soft shadows, clean warm cream background (#f3ecdf) where background is visible, palette of cream, sand, "
            "sage green, terracotta, teal water, silver-grey; cozy, charming, calm; no text, no letters, no logos, no watermarks.")
PRE_A = ("Match the handmade clay toy look, materials, lighting and plain cream background of the reference images, but make a "
         "completely different building exactly as described. ")
ADDON = ("as a chunky handmade clay-and-painted-wood toy model, centered on a plain flat warm cream background (#f3ecdf), "
         "three-quarter view from about 25 degrees above {view}, the whole {what} in frame with generous margin, soft even studio "
         "light, only a faint contact shadow. {depth}Simplified toy proportions: thick walls, rounded edges, few large windows and "
         "openings, bold readable silhouette. {colours} No base, no plinth, no ground patch, no lawn, no sidewalk, no water, no people, "
         "no thin wires, poles, railings, antennas or cables, no text, numbers, signs or logos.")

LANDMARKS = {
    "cal-academy": dict(
        what="museum", view="showing the long front facade and its right end",
        subject="San Francisco's California Academy of Sciences (Renzo Piano, 2008) as one compact toy building: a long low rectangular "
                "museum with glass walls all round under a thin flat white roof slab that overhangs the walls as a wide shading canopy "
                "carried on slim white columns along the front; on top of the roof a living roof of green wildflower meadow that rises "
                "into two big round grassy domes (a larger one on the left half, a second one on the right half) and a few smaller gentle "
                "grassy humps between them, the two big domes dotted with rows of small round porthole skylights; a glass entrance in "
                "the middle of the front facade",
        depth="The building is about one and a half times as wide as it is deep and much wider than it is tall. ",
        colours="Living roof meadow green (#9fbf7a) with soft sage shading (#6f9a5b) and tiny cream flower dots, white roof edge and "
                "columns (#f4f1e6), pale teal-grey glass (#bfdbe6), a sand stone band at the foot of the walls (#d9ccb3)."),
    "st-ignatius": dict(
        what="church", view="showing the front facade and its right side",
        subject="San Francisco's St Ignatius Church (1914, the Jesuit church of the University of San Francisco) as a chunky toy: a big "
                "Italian-Renaissance and Baroque basilica whose symmetrical front stands between two tall bell towers; each tower rises in "
                "four stages, square at the bottom and octagonal above, with an open arched belfry stage and a small round domed lantern "
                "on top crowned by a small chunky cross; between the towers a front with big columns and pilasters, a triangular "
                "pediment over a large arched central window and three arched entrance doors; behind the front a long nave with a "
                "terracotta tile gable roof and a round dome on a drum over the crossing",
        depth="The church is about twice as deep as it is wide; the towers are the tallest part, about twice the height of the nave. ",
        colours="Walls flat warm buff brick and cream stone (#e9d9bb) with cream terracotta trim (#f3e6cc), terracotta tile roofs "
                "(#d07a55), buff domes and lanterns like the walls, teal-grey window glass."),
    "holy-virgin": dict(
        what="cathedral", view="showing the front and its right side",
        subject="San Francisco's Holy Virgin Cathedral, a Russian Orthodox cathedral of 1961-65, as a chunky toy: a compact tall white "
                "church body with rounded arched gables along the tops of the walls, deep red painted trim bands, arches and window "
                "surrounds, tall round-arched windows and a front entrance porch with a big round-arched doorway; above the roof five "
                "tall round drums with arched windows, each crowned by a shiny gold onion dome topped by a small chunky gold cross, a "
                "larger drum and dome in the centre and four smaller ones at the four corners",
        depth="The cathedral is about as deep as it is wide and a little taller than it is wide. ",
        colours="Walls flat white (#f4f1e6) with deep red trim, bands and arches (#b8463c), gold onion domes (#e0a94a) with warm "
                "highlights, silver-grey roofs (#a7b0a8), teal-grey window glass."),
    "chinese-pavilion": dict(
        what="pavilion", view="showing it from the front",
        subject="the Chinese Pavilion on Blue Heron Lake in San Francisco's Golden Gate Park (a 1981 gift from the sister city Taipei) as a "
                "chunky toy: a small open octagonal Chinese garden pavilion, eight round red columns standing on its own low octagonal "
                "grey stone floor with one step, low solid red bench walls between the columns except at the open entrance, carved red "
                "and gold beams under the eaves, and one broad octagonal roof of grey-green glazed tiles with strongly upturned pointed "
                "corners, cream ridge lines and a small round spire finial on the top; completely open, you can see through between "
                "the columns",
        depth="The pavilion is about as tall as it is wide. ",
        colours="Vermilion-red columns, beams and bench walls (#b8463c) with small gold and teal painted details, grey-green glazed "
                "tile roof (#7f9c8f) with cream ridges, light grey stone floor (#bdb3a2)."),
}


def landmark_prompt(k, variant):
    d = LANDMARKS[k]
    body = f"{d['subject']} " + ADDON.format(view=d["view"], what=d["what"], depth=d["depth"], colours=d["colours"]) + " " + CONTRACT
    return (PRE_A + body) if variant == "a" else body


VEHICLE_ADDON = ("Show it four times on one plain flat warm cream background (#f3ecdf): a straight side view of the whole vehicle facing "
                 "right as the largest view across the top, and below it, side by side, a straight front view, a straight back view "
                 "and a view from directly above, all at the same scale, neatly spaced, not overlapping, soft even studio light, only "
                 "faint contact shadows. Chunky handmade clay-and-painted-wood toy proportions: rounded edges, thick parts, few large "
                 "windows, bold readable shapes, no thin wires or railings. Generic design: no brand, no logos, no text, no numbers, "
                 "no route signs, no people. ")
VEHICLES = {
    "tour-bus": ("A reference sheet for a toy model of a generic open-top double-decker sightseeing bus. The body is rounded coral red "
                 "(#e0563f) with a cream band (#f6ecd9) along the sides just under the upper deck, the lower deck has big teal-grey "
                 "windows and a wide door at the front on the right side, the open upper deck has four rows of cream benches facing "
                 "forward behind a chunky solid front parapet and low solid side walls, a staircase at the back, round dark tyres with "
                 "cream hubs, round headlamps and a plain blank front. "),
    "lrv": ("A reference sheet for a toy model of a generic two-car light-rail train, like a San Francisco Muni Metro light-rail vehicle: "
            "two cars joined by a flexible bellows. Silver-grey body (#b8c0c4) with a red belt line (#c8453a) along the sides under the "
            "windows, a long band of teal-grey windows, two double doors on each car, a rounded front at both ends with a big windscreen "
            "and a plain blank headsign box above it, a chunky folded pantograph on the roof drawn as a solid arm, dark bogies with "
            "wheels. "),
}


def vehicle_prompt(k):
    return VEHICLES[k] + VEHICLE_ADDON + CONTRACT


# the 16 map T1 attractions of plan §4.1, row by row in the sheet (lane P's attraction ids)
STICKER_IDS = [
    "golden-gate-bridge", "alcatraz", "fishermans-wharf", "ferry-building-marketplace",
    "coit-tower", "chinatown-dragon-gate", "lombard-crooked", "palace-of-fine-arts",
    "golden-gate-park", "alamo-square-painted-ladies", "twin-peaks", "city-hall",
    "union-square", "sutro-baths", "sf-state-university", "stonestown-galleria",
]
STICKER_SUBJECTS = [
    "the Golden Gate Bridge: one tall international-orange bridge tower with a piece of its suspension span over blue water",
    "Alcatraz: a small rocky island with a pale cellhouse block and a little lighthouse, in blue water",
    "Fisherman's Wharf: a small teal fishing boat beside a wooden pier with a big red crab",
    "the Ferry Building: a cream clock tower with a blank round clock face over a long pier building, blue water in front",
    "Coit Tower: a white fluted column tower on top of a green hill",
    "the Chinatown Dragon Gate: a gate with three jade-green curved tile roofs on red pillars",
    "Lombard Street: a red-brick road zigzagging down a steep hill between bright flower hedges",
    "the Palace of Fine Arts: a salmon-pink domed rotunda with columns, reflected in a small lagoon",
    "Golden Gate Park: a green meadow with round trees, a small blue lake and a little white glass conservatory",
    "the Painted Ladies: a row of pastel Victorian houses behind a green lawn",
    "Twin Peaks: two rounded grassy peaks with a winding road",
    "City Hall: a white palace with a sage-green dome trimmed in gold",
    "Union Square: a tall column with a small bronze winged victory statue on top, framed by two palm trees",
    "the Sutro Baths: old concrete ruin walls and pools at the edge of the ocean, rocks and white surf",
    "San Francisco State University: a campus lawn in front of a low modern student centre with a sharply angled roof, a young tree",
    "Stonestown Galleria: a long low two-storey shopping centre with a glass entrance canopy and a few trees",
]
STICKER_PROMPT = (
    "A sheet of 16 round die-cut map stickers arranged in a neat 4 by 4 grid on a plain flat warm cream paper background (#f3ecdf), "
    "with even generous gaps between them. Every sticker is a circle of exactly the same size with a thick soft cream-white border and "
    "a faint soft shadow, painted in hand-painted gouache and soft watercolour exactly like the attached illustrated map (same "
    "palette, soft brush texture, gentle edges), with the charm and warm light of the attached toy diorama. Each sticker is a tiny "
    "charming illustration of one San Francisco landmark filling its circle, with simple bold readable shapes that still read when "
    "the sticker is small, and a soft pale sky or ground behind the subject inside its circle. "
    + " ".join(f"Row {r + 1}, left to right: " + "; ".join(f"({c + 1}) {STICKER_SUBJECTS[r * 4 + c]}" for c in range(4)) + "."
               for r in range(4))
    + " No text, no letters, no numbers, no labels, no logos, no signs anywhere, no people.")


def build():
    out = {"refs": {"K6": K6, "ROT": ROT, "PAPER": PAPER}, "landmarks": {}, "vehicles": {}, "stickers": {}}
    for k in LANDMARKS:
        out["landmarks"][k] = {"a": {"refs": [K6, ROT], "prompt": landmark_prompt(k, "a")},
                               "b": {"refs": [K6], "prompt": landmark_prompt(k, "b")}}
    for k in VEHICLES:
        out["vehicles"][k] = {"refs": [K6], "prompt": vehicle_prompt(k)}
    out["stickers"] = {"ids": STICKER_IDS, "refs": [K6, PAPER], "prompt": STICKER_PROMPT}
    return out


if __name__ == "__main__":
    data = build()
    with open(os.path.join(HERE, "prompts.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(json.dumps({k: len(v) if isinstance(v, dict) else v for k, v in data.items()}))
