"""Wave-6 lane X Higgsfield prompts (provenance). Writes prompts.json next to this file.

python scripts/opus-sf/assets/w6/prompts.py            -> scripts/opus-sf/assets/w6/prompts.json

X-P · the Halloween postcard set (four cards: the pumpkin hunt's end, trick-or-treat, the big night, Día de los Muertos)
for lanes H and G: the recipe of every shipped postcard (ASSETS-LEDGER T1-1…13, wave-4 W4V-P1…P4, wave-5 W5V-P1…P6):
nano_banana_pro 4:3 2k, refs P5 + P13, subject + FULL_BLEED + LOOK + CONTRACT (scripts/opus-sf/assets/w4/prompts.py,
imported verbatim) + the full-frame line wave 5 needed for two retakes. Scenes only: no text, no numbers, no logos, no
faces, no copy of a real artwork or a real altar; the Día de los Muertos card shows the tradition's generic elements
(marigolds, cut-paper banners with plain cut patterns, candles, bread, sugar-skull shapes as decoration) with respect.
The golden-hour line of the contract is replaced by the scene's own light where the card is set at dusk or at night.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "w4"))
from prompts import CONTRACT, FULL_BLEED, LOOK, P5, P13  # noqa: E402

NO_TEXT = " No signs, no lettering, no numbers anywhere; no human faces (only the pumpkins' carved ones)."
FULL_FRAME = " The scene fills the whole frame edge to edge: no floating slab, no base edge, no cream void around the scene."
# the contract's light is golden hour; the night cards keep every other word of it
NIGHT_CONTRACT = CONTRACT.replace("warm golden-hour light", "warm glowing lantern light in a soft blue dusk")

HALLOWEEN_POSTCARDS = {
    # the pumpkin hunt's end (lane H): every jack-o'-lantern found
    "halloween-pumpkin-hunt": (
        "A cosy Halloween pumpkin patch on a grassy park hill in San Francisco as a handmade miniature diorama at twilight: dozens "
        "of small carved jack-o'-lanterns with friendly smiling carved faces glowing warm orange from inside, gathered in a happy "
        "heap and lined along a curving path, a few plain uncarved pumpkins and straw bales, fallen autumn leaves, a string of "
        "little round paper lanterns between two trees, and beyond the hill the soft lights of pastel Victorian houses and the "
        "city under a deep blue evening sky with a few small friendly bats.", NIGHT_CONTRACT),
    # trick-or-treat (lane G): a decorated door answered
    "halloween-trick-or-treat": (
        "The front steps of a pastel San Francisco Victorian house on Halloween evening as a handmade miniature diorama: a "
        "carved wooden front door with a warm orange porch light, a big bowl of wrapped candies on the top step, three smiling "
        "jack-o'-lanterns on the stairs, a tiny black witch hat and a small plain white ghost-sheet costume hanging on the railing, "
        "cotton cobwebs in the corner of the bay window, a small trick-or-treat candy bucket in the shape of a pumpkin on the "
        "sidewalk, autumn leaves, the neighbouring painted houses glowing softly.", NIGHT_CONTRACT),
    # the big night, 31 Oct (lanes H / G): the whole street out
    "halloween-big-night": (
        "The Painted Ladies, a row of pastel Victorian houses facing a green park hill in San Francisco, on Halloween night as a "
        "handmade miniature diorama: every stoop crowded with glowing carved jack-o'-lanterns, warm orange porch lights, strings of "
        "little orange lights along the railings, a big round pale moon low over the downtown skyline, small friendly bats in the "
        "deep blue sky, a few tiny clay trick-or-treaters in simple costumes seen from behind walking up the path with pumpkin "
        "buckets.", NIGHT_CONTRACT),
    # Día de los Muertos, 1–2 Nov (lane H): the Mission
    "muertos-mission": (
        "A street in the Mission District of San Francisco on the evening of Día de los Muertos as a handmade miniature diorama: "
        "a small colourful community altar of wooden steps covered with bright orange and yellow marigold flowers, lit candles, "
        "round sweet bread, bowls of fruit and small white sugar-skull shapes decorated with coloured icing flowers, arches of "
        "marigolds, rows of cut-paper papel picado banners in pink, orange, purple, green and blue with plain cut flower and "
        "diamond patterns strung across the street, a colourful stucco building behind, marigold petals scattered on the sidewalk, "
        "warm candle glow in a soft blue dusk.", NIGHT_CONTRACT),
}


# retake (draw a: the blue night backdrop ended in a cut edge on the cream void at the right — wave 4's slab fault): seen
# from the park hill, the night sky filling the frame; the contract without its cream-background clause (sent verbatim)
BIG_NIGHT_B = (
    "The Painted Ladies, a row of pastel Victorian houses facing a green park hill in San Francisco, on Halloween night as a "
    "handmade miniature diorama, seen from the grass of the park hill itself so that the scene fills the whole frame edge to "
    "edge: every stoop crowded with glowing carved jack-o'-lanterns, warm orange porch lights, strings of little orange lights "
    "along the railings, a big round pale moon low over the downtown skyline behind the houses, small friendly bats in the deep "
    "blue night sky that fills the whole top of the frame, a few tiny clay trick-or-treaters in simple costumes seen from "
    "behind walking along the path with pumpkin buckets." + NO_TEXT + " No floating slab, no base edge, no backdrop edge, no "
    "cream void around the scene. " + FULL_BLEED + " " + LOOK + " Soft handcrafted miniature diorama, tilt-shift toy "
    "photography feel, matte clay and painted wood materials, warm glowing lantern light in a soft blue dusk, gentle soft "
    "shadows, palette of cream, sand, sage green, terracotta, teal, silver-grey; cozy, charming, calm; no text, no letters, no "
    "logos, no watermarks.")


def postcard_prompt(k):
    subject, contract = HALLOWEEN_POSTCARDS[k]
    return f"{subject}{NO_TEXT}{FULL_FRAME} {FULL_BLEED} {LOOK} {contract}"


def build():
    return {"refs": {"P5": P5, "P13": P13},
            "halloween_postcards": {k: {"model": "nano_banana_pro", "aspect_ratio": "4:3", "resolution": "2k", "refs": [P5, P13],
                                        "prompt": postcard_prompt(k)} for k in HALLOWEEN_POSTCARDS},
            "retakes": {"halloween-big-night-b": {"model": "nano_banana_pro", "aspect_ratio": "4:3", "resolution": "2k",
                                                  "refs": [P5, P13], "prompt": BIG_NIGHT_B}}}


if __name__ == "__main__":
    data = build()
    with open(os.path.join(HERE, "prompts.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
