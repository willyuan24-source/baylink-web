# Continuous Little Bay world

The `/play` default now joins San Francisco, the Peninsula, South Bay and East Bay in one Three.js Canvas. Changing the regional focus moves the camera without loading a different world or awarding a visit. The existing 68 landmarks retain their photographs, guide links and official visitor information.

## Exploring and navigation

- A shared geographic projection places the coastline, landmarks, mainland corridors and four bridges around one bay. The ground, bridge decks and navigation graph use the same traversability checks.
- Players can walk with BAYBAY, drive, preview a destination, explicitly quick-travel nearby, or follow a game route automatically. Mouse/keyboard and touch joystick controls retain camera-relative movement.
- Manual input takes over immediately. Resuming a route replans from the current position, including within the Alcatraz ferry channel. Invalid water shortcuts are rejected.
- Named destinations end at an approachable point inside the attraction's arrival area; they do not put the character in the building's centre. Quick travel starts outside the arrival area and does not itself award a visit.
- Four clickable region labels, place search, the route ribbon, a live minimap, camera controls and destination interactions remain inside the fullscreen stage. The portrait route card leaves room to see the character.

## Play and useful local content

Four ordered adventures contain thirteen stops and four virtual badges. Opening a location or selecting it on a map never completes a stop: the player must physically arrive and check in. Progress is isolated by account and stored in the current browser. The existing SF discovery journal and minigames remain accessible, with the detailed garden/cable-car world preserved as an optional excursion.

Place panels show the matching real photograph, an expandable image, existing guide preview, official information, real-world map link and genuinely matched events for the chosen day. Outing additions reflect the current ticket and avoid duplicate additions. This change does not create or fabricate real events or prizes.

## Rendering and checks

The shared world uses distance-based landmark proxies and instanced scenery; tiny residential/tree detail disappears in the whole-bay view. The camera fits the populated shoreline on portrait screens and switches to a close follow view when walking/driving. Remote Mount Hamilton remains in the same navigable world; selecting it or routing there expands the minimap as needed.

Browser review covered desktop overview and BAYBAY follow views, portrait fullscreen, search and real-photo panels, SF-to-Peninsula navigation, ferry arrival, a cross-bay Oakland trip, and a journal check-in that remained disabled until arrival. Navigation tests cover quick-travel timing, manual takeover, modal/world pauses, zero-length routes, ferry replanning, shoreline safety and all landmark destinations. Exhaustive routing checks covered 4,624 landmark pairs.

Final local validation: 657 tests passed; TypeScript and production build passed; 263 public pages prerendered; all 238 share-card dimensions and direct-link QR codes verified. ESLint reported no errors, with existing repository warnings; changed modules and new tests passed their targeted lint check without warnings.

This is a geographically arranged miniature game: coastlines and corridors are simplified and its route instructions are not real-world travel directions. Visits and badges are virtual. Higgsfield credits used: 0.
