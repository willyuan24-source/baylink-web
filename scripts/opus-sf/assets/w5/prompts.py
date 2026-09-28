"""Wave-5 lane V Higgsfield prompts (provenance). Writes prompts.json next to this file.

python scripts/opus-sf/assets/w5/prompts.py            -> scripts/opus-sf/assets/w5/prompts.json

H5-2 · six 彩蛋明信片 (secret postcards), found with lane D's eggs (plan sf-w5-plan.md §5): the recipe of the 16 shipped SF
postcards (ASSETS-LEDGER T1-1…13, wave-4 W4V-P1…P4): nano_banana_pro 4:3 2k, refs P5 + P13, subject + FULL_BLEED + LOOK +
CONTRACT (scripts/opus-sf/assets/w4/prompts.py, imported verbatim). The subject lines paint scenes only: no text, no
numbers, no logos, no people's faces, no copy of an artwork (the Wave Organ and the Lands End labyrinth are drawn as
generic stones and pipes / a ring of stones). The facts behind each scene are lane D's (eggs/registry.ts, with sources).
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "w4"))
from prompts import CONTRACT, FULL_BLEED, LOOK, P5, P13  # noqa: E402

NO_TEXT = " No signs, no lettering, no numbers anywhere; no faces."

# egg id (eggs/registry.ts EGG_IDS) -> the scene
SECRET_POSTCARDS = {
    "china-beach-fishermen": (
        "China Beach, a small sandy cove below the Sea Cliff bluffs of San Francisco, as a handmade miniature diorama at golden "
        "hour: a curved strip of pale sand under steep sandstone-and-green cliffs topped by cypress trees, gentle white surf, and "
        "out on the calm teal water the dark silhouettes of two old Chinese fishing junks with ribbed, battened sails, the low sun "
        "warm over the ocean, the terracotta-orange Golden Gate Bridge small in the far distance." + NO_TEXT),
    "telegraph-hill-parrots": (
        "The Filbert Street Steps on Telegraph Hill in San Francisco as a handmade miniature diorama: weathered wooden stairs "
        "climbing through lush overgrown cottage gardens full of flowers, ferns and small palms, little pastel wooden cottages "
        "beside the stairs, and a flock of bright green parrots with red heads flying between the trees and perching on a branch, "
        "soft morning light, the white fluted top of Coit Tower peeking above the hill." + NO_TEXT),
    "wave-organ-high-tide": (
        "The tip of the Marina jetty in San Francisco at high tide as a handmade miniature diorama: a small terrace of old carved "
        "granite and marble blocks and stone benches at the end of a rocky breakwater, short grey pipes ending among the stones "
        "at the water's edge, lively teal waves splashing up against the rocks, a few sailboats on the bay and the terracotta-orange "
        "Golden Gate Bridge in the distance, fresh afternoon light." + NO_TEXT),
    "lands-end-labyrinth": (
        "A stone labyrinth on a rocky headland at Lands End in San Francisco as a handmade miniature diorama: a round path of small "
        "pale stones laid in concentric rings on a flat point of the cliff above the ocean, wind-bent cypress trees at the edge, "
        "white surf far below, and across the strait the terracotta-orange Golden Gate Bridge framed between the headland and the "
        "Marin hills, clear late-afternoon light." + NO_TEXT),
    "dahlia-dell-100": (
        "The dahlia garden beside the Conservatory of Flowers in Golden Gate Park as a handmade miniature diorama in full bloom: a "
        "garden bed packed with big dahlias of every colour - pink, red, orange, yellow, purple and white pompoms and large "
        "dinner-plate blooms on tall stems - a string of little plain paper pennants between two garden posts for a birthday, and "
        "behind it the white Victorian glass conservatory with its central dome, sunny afternoon light." + NO_TEXT),
    "ggb-foghorn-duet": (
        "The Golden Gate Bridge in thick summer fog as a handmade miniature diorama: the two terracotta-orange towers rising out of "
        "a soft rolling bank of white fog that hides the deck and the water, only the tops of the towers and the sweep of the main "
        "cables showing above it, the green Marin headlands behind, gentle blue-grey morning light, a quiet dreamy mood."
        + NO_TEXT),
}


# retakes (draw a came out as a floating diorama slab with its side edges on the cream void — wave 4's sf-west-portal fault;
# the same fix: the scene seen from within, filling the frame)
FULL_FRAME = " No floating slab, no base edge, no cream void around the scene."
SECRET_POSTCARDS["china-beach-fishermen-b"] = SECRET_POSTCARDS["china-beach-fishermen"].replace(
    "as a handmade miniature diorama at golden hour:",
    "as a handmade miniature diorama at golden hour, seen from the sand of the cove itself so that the scene fills the whole "
    "frame edge to edge:") + FULL_FRAME
SECRET_POSTCARDS["lands-end-labyrinth-b"] = SECRET_POSTCARDS["lands-end-labyrinth"].replace(
    "as a handmade miniature diorama:",
    "as a handmade miniature diorama, seen from the cliff path beside it so that the scene fills the whole frame edge to edge:"
) + FULL_FRAME


def secret_postcard_prompt(k):
    return f"{SECRET_POSTCARDS[k]} {FULL_BLEED} {LOOK} {CONTRACT}"


def build():
    return {"refs": {"P5": P5, "P13": P13},
            "secret_postcards": {k: {"model": "nano_banana_pro", "aspect_ratio": "4:3", "resolution": "2k", "refs": [P5, P13],
                                     "prompt": secret_postcard_prompt(k)} for k in SECRET_POSTCARDS}}


if __name__ == "__main__":
    data = build()
    with open(os.path.join(HERE, "prompts.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(json.dumps({k: v["prompt"] for k, v in data["secret_postcards"].items()}, ensure_ascii=False)[:300])
