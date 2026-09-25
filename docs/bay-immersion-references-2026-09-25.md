# Bay Area exploration: references and implementation choices

The user requested another visual and playable pass on the existing continuous BAYLINK world, with city names on the map and arrival titles. This is an extension of BAYLINK's own characters, data and style.

## Reference review

- [Bruno Simon's live portfolio](https://bruno-simon.com/) exposes a contextual interaction action, a map, recovery controls, achievements and optional sound/quality settings. Its [first-party repository](https://github.com/brunosimon/folio-2025) separates player motion, interaction points, zones, the view and instanced scenery in the game loop. The useful pattern for BAYLINK is that travelling reveals small things to do, while the main view remains navigable. No Bruno code, models, music or game assets were copied. The page's text and repository were inspected; the attempted WebGL browser reference capture timed out, so no successful visual-playthrough claim is made.
- Nintendo's [Animal Crossing island exploration](https://animalcrossing.nintendo.com/new-horizons/es/explore/) and [community play](https://animalcrossing.nintendo.com/new-horizons/share/) describe unhurried observation, collections, places and conversations. BAYLINK translates those broad patterns into original Bay Area discoveries and a field notebook, without reusing characters, objects or branded game UI.
- [Higgsfield 3D Jutsu](https://higgsfield.ai/3d-jutsu) and the installed connector were checked. The live model catalog returned Meta SAM 3 3D Objects and Meshy single-/multi-image-to-3D models, with GLB output and available remeshing, target polycount, textures and optional rigging. The current connector also exposes project-scoped Blender editing and a curated GLB asset catalog. This establishes available capabilities, not tested output quality. No job, paid generation, import or new external scene was submitted.

## What changes in BAYLINK

1. Cities become a readable layer between the whole-bay regions and individual attractions. A city preview frames its own location, including cities without a dedicated attraction model. A physical arrival title uses a dwell interval and boundary hysteresis, so orbiting the camera does not pretend the character travelled there.
2. A small set of distinctive landmark silhouettes replaces repeated far-view boxes. Gardens, entrances, contact shadows, coastline detail and nearby wildlife provide scale and a sense of place. Distant scenery stays inexpensive and animation follows pause and reduced-motion preferences.
3. Contextual discoveries add observations, short local conversations and a sequence puzzle. They connect to the existing attraction navigation and guides. Collection requires an actual nearby character; a map preview cannot award a memory.
4. Field notes keep the extra activities discoverable without covering the world with permanent text. The desktop interaction key and touch button open the same encounter. The existing four route quests and real outing planner remain available.

Higgsfield image-to-3D could be useful later for a small hero building or an original NPC with consistent reference views. For this pass, editable low-poly geometry is the most direct way to keep landmark silhouettes, collision surfaces, the accepted palette and phone rendering consistent. Credit expenditure for this pass: 0.
