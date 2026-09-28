# Owner feedback · phone playtest, 2026-09-27 evening

Build: the LAN phone package from `d118962` (wave-4 integration in progress), `http://10.0.0.85:4174/opus-bay?world=city`.
The owner asked to finish the running work and verify it first, then improve with these (wave 5). Nothing here needs
the owner's approval before it is built; the defaults below are the lead's.

## The owner's words (Chinese, verbatim) and what they mean

> 有时如果飞的话，下来的时候，很多时候卡住，需要对话后，才能移动

**F1 · Stuck after landing (bug, high).** After flying (pelican glide and / or fast travel 飞过去) the player often
cannot move after landing until a dialogue has been opened and closed. Something keeps the input locked (the travel /
glide / cinematic / arrival state, a dialogue or card that never releases, the move mode staying 'glide' / 'travel').
Reproduce on the phone profile (touch) and desktop, for glide landings, fast-travel descents and arrivals with an arrival
card; fix at the root; a test that the player can walk within 1 s of every landing path.

> 地图上很多不知道是否地形问题，很多也是走不动，例如去到金门桥那边，去 sightseeing 就过不了，或者让主角一定，多接触一下地形限制

**F2 · Blocked walking (bug, high).** Many places cannot be walked through; e.g. toward the Golden Gate Bridge the
sightseeing route / trip does not get through. Make movement forgiving: find and remove invisible walls and snags
(blockers that do not match what is drawn, steep-slope refusals on paths people expect to walk, gaps between chunks,
landmark exclusions), let the player step up / slide past small obstacles, auto-unstick, and make every trip / 带我去 /
sightseeing leg actually reachable. Sweep the city with an automated walker (every attraction arrival, every loop / Metro
stop, the three routes, the GGB deck end to end) and fix every place it gets stuck.

> 最好先推荐做任务拿到鸟，这样可以随时飞，不用跑得太慢

**F3 · Get the pelican early.** The onboarding (and BAYBAY's first suggestions / the goals card) should point the player
to the task that unlocks the pelican glide early, so they can fly any time instead of walking slowly across a big city.
Default: the glide-unlock goal is the first city goal BAYBAY recommends, with a clear waypoint; once unlocked, a visible
"飞" button on phones and a one-line hint; consider making the unlock quicker in city mode.

> 要简易一下自动导航，例如我想去地图上一个地方，最好容易按就可以导航自己去

**F4 · One-tap navigation.** Going somewhere on the map must be one easy tap: tap any place (or any point on the map)
→ one big button that takes you there automatically with the best mode (walk / bike / ride / fly, BAYBAY leading),
no extra menus unless the player wants them. Works the same on phones.

> 也可以加一点金币系统，出来明信片，可以捡金币，金币可以兑换某些特殊道具

**F5 · Coins and a small shop (new feature).** Coins to pick up in the world (near postcards, at attractions, along the
lines, a few hidden), a coin counter in the HUD, saved in save v2; a shop to exchange coins for special items. Default
items (cosy, cosmetic or convenience, never pay-to-win or real money): BAYBAY scarves / hats, the player's hat and
backpack colours, bike and toy-car colours, the pelican's ribbon, photo frames / postcard stamps, and a few
conveniences (e.g. a free 飞过去 ticket). Coins also reward arrivals, favours and postcards. Chinese and English text, touch
first, no economy that forces grinding.

## Order (lead)

1. Finish wave-4 integration and its reviews; final verify (perf table alone on the machine, phone profile, CI).
2. Wave 5 (完善): F1 and F2 first (bugs), then F4, F3, F5, plus the verify findings still open.
