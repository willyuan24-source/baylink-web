"""Concept prompts for the whole-SF house kit (lane H2a). Writes prompts.json (provenance) and reqs.json (batch)."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
CONTRACT = ("Soft handcrafted miniature diorama, tilt-shift toy photography feel, matte clay and painted wood materials, warm golden-hour light, "
            "gentle soft shadows, clean warm cream background (#f3ecdf) where background is visible, palette of cream, sand, sage green, terracotta, "
            "teal water, silver-grey; cozy, charming, calm; no text, no letters, no logos, no watermarks.")
PRE = ("Match the handmade clay toy look, materials, lighting and plain cream background of the reference images, "
       "but make a completely different building exactly as described. ")
DEEP = ("The building is narrow and deep like a real San Francisco row house: its plain right side wall is about one and a half times "
        "as long as the front is wide.")


def addon(subject, walls, deep=DEEP, view="showing the front facade and its right side wall"):
    return (f"A single {subject} as a chunky handmade clay-and-painted-wood toy model, centered on a plain flat warm cream background (#f3ecdf), "
            f"three-quarter view from about 25 degrees above {view}, the whole building in frame with generous margin, soft even studio light, "
            f"only a faint contact shadow. {deep} Simplified toy proportions: thick walls, rounded edges, few large windows and openings, bold readable "
            f"silhouette, the front door and windows clearly readable. {walls} No base, no plinth, no ground patch, no sidewalk, no people, no thin wires, "
            f"poles, railings, antennas or cables, no text, numbers, signs or logos.")


K = {
    "edwardian-flats": addon(
        "three-storey San Francisco Edwardian flats building (one flat per floor): a full-height angled bay window column stacked on all three floors "
        "on the right, a recessed entry porch with two chunky round columns and a short front stoop on the left, a heavy projecting cornice with big "
        "square brackets across the top, flat roof",
        "Walls in one flat pale powder blue (#c9d6e8) painted wood siding, crisp cream-white trim, silver-grey (#8c9aa6) flat roof."),
    "stick-victorian": addon(
        "three-level San Francisco Stick-Eastlake Victorian row house (two storeys over a raised basement): a tall square-cornered (not angled) bay "
        "window rising two storeys, vertical stick-work trim boards and carved panels, tall narrow windows with pointed hood trims, a tall flat "
        "false-front parapet with a bracketed cornice that hides the roof, a hooded entry porch reached by a straight front stoop",
        "Walls in one flat pale lilac (#d9c8e6), crisp cream-white trim, silver-grey (#8c9aa6) roof."),
    "queen-anne-corner": addon(
        "three-storey San Francisco Queen Anne Victorian on a corner lot: a round turret with a tall conical roof on the front-right corner facing "
        "both streets, fish-scale shingles in a front gable, bay windows, a front stoop with a single door; because it stands on a street corner its "
        "right side wall also has windows and trim",
        "Walls in one flat dusty rose pink (#e8c6cf), crisp cream-white trim, silver-grey slate (#8c9aa6) roofs.",
        deep="The corner house is about one and a quarter times as deep as it is wide."),
    "sunset-doelger": addon(
        "two-storey 1940s San Francisco Sunset District Doelger-style stucco row house: a wide garage door at street level, a short side stair up to "
        "a recessed arched entry, one large living-room picture window above the garage, a stepped decorative stucco parapet on top (Marina-style "
        "stepped facade) with a small band of terracotta Spanish tiles, flat roof hidden behind the parapet",
        "Walls in one flat smooth pastel mint green stucco (#cfe0d0), crisp cream-white trim, terracotta (#d07a55) tile accents."),
    "marina-mediterranean": addon(
        "two-storey San Francisco Marina District Mediterranean-revival stucco house: a round-arched garage door at street level, a big "
        "round-arched feature window above it with a small chunky solid balcony, an arched entry with a little terracotta tile hood, a low "
        "terracotta tile hip roof with deep eaves",
        "Walls in one flat warm peach-sand stucco (#f2c9b1), crisp cream-white trim, terracotta (#d07a55) tile roof."),
    "richmond-flats": addon(
        "three-storey San Francisco Richmond District stacked flats: three front doors side by side under a wide round-arched entry porch at the "
        "ground floor with a short stoop, a full-height rectangular box bay window column above on the right, simple rectangular windows on the "
        "left, a plain parapet with a thin cornice, flat roof",
        "Walls in one flat soft butter yellow stucco (#f4e2a8), crisp cream-white trim, silver-grey (#8c9aa6) flat roof."),
    "chinatown-shophouse": addon(
        "three-storey San Francisco Chinatown shophouse: a ground-floor shop with big blank windows under a jade-green tiled awning with upturned "
        "corners, two upper floors each with a recessed balcony behind a chunky solid terracotta-red balcony parapet, a pagoda-style upturned "
        "jade-green tile cornice along the roofline, flat roof; completely blank, no signs, no lettering, no lanterns",
        "Walls in one flat warm cream (#ece2cf), terracotta-red (#b8463c) balconies and window frames, jade green (#2f7d5a) tiles."),
    "northbeach-corner": addon(
        "three-storey San Francisco North Beach mixed-use corner building: a cafe at street level with large cafe windows on both street faces, a "
        "blank striped terracotta-and-cream fabric awning wrapping around the corner, a cut-off corner entrance door, two upper floors of apartments "
        "with angled bay windows on the front and on the right side street face, a simple cornice, flat roof",
        "Walls in one flat warm ochre yellow (#f0d49a), crisp cream-white trim, silver-grey (#8c9aa6) flat roof.",
        deep="Because it stands on a street corner, the right side wall is a second street facade with windows, about one and a quarter times as "
             "long as the front is wide."),
    "soma-warehouse": addon(
        "three-storey San Francisco SoMa red-brick loft warehouse: a wide front with rows of tall round-arched windows with cream stone arches and "
        "keystones, a big round-arched wooden loading door on the ground floor, a brick parapet with a simple cream cornice, flat roof",
        "Walls in flat terracotta red brick (#b56e55) with softly modelled brick courses, cream stone trim, teal-grey window glass.",
        deep="The warehouse is about as deep as it is wide."),
    "mission-mural": addon(
        "two-storey San Francisco Mission District corner shop building: a ground-floor shop front with big windows under a blank teal striped "
        "fabric awning, one upper floor with a pair of simple windows, a flat parapet with a simple cornice, flat roof; the long right side wall is "
        "covered by an original colourful community mural of stylised sun rays, big marigold flowers, hummingbirds and rolling hills in terracotta, "
        "teal, gold and sage, abstract and cheerful, no text, no faces, not a copy of any existing mural",
        "Front walls in one flat warm marigold orange (#f0b15a), crisp cream-white trim."),
    "deco-apartment": addon(
        "five-storey 1930s San Francisco Nob Hill art-deco apartment building: symmetrical front with a central vertical band of stacked windows "
        "between fluted piers, rounded corner windows, a stepped zigzag parapet crown, a recessed entry under a chunky rounded canopy, flat roof",
        "Walls in one flat cream-white stucco (#efe6d6) with sage green (#7f9c8f) and terracotta (#d07a55) decorative relief panels.",
        deep="The building is about one and a quarter times as deep as it is wide."),
}
K6 = "3617006b-483d-4ea7-9e72-39b681f8264f"  # key art (part-1 style ref)
HB = "cad51afe-56a0-47f7-ad6d-5e6d8d0b71cd"  # part-1 house B concept (clay-toy house look)
out = {k: {"a_refK6+HB": PRE + v + " " + CONTRACT, "b_refK6": v + " " + CONTRACT} for k, v in K.items()}
json.dump(out, open(os.path.join(HERE, "prompts.json"), "w"), indent=1)
reqs = []
for n, (k, v) in enumerate(out.items()):
    base = {"model": "nano_banana_pro", "aspect_ratio": "1:1", "resolution": "2k"}
    reqs.append({"index": 2 * n, "params": {**base, "prompt": v["a_refK6+HB"],
                 "medias": [{"value": K6, "role": "image_references"}, {"value": HB, "role": "image_references"}]}})
    reqs.append({"index": 2 * n + 1, "params": {**base, "prompt": v["b_refK6"], "medias": [{"value": K6, "role": "image_references"}]}})
json.dump(reqs, open(os.path.join(HERE, "reqs.json"), "w"))
print(len(reqs), list(K))
