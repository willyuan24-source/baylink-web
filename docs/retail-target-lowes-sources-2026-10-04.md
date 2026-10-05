# Target / Lowe’s offer research — 2026-10-04

Internal editorial evidence log for BAYLINK. Reviewed against America/Los_Angeles date 2026-10-04. Read-only research; no accounts created, purchases made, or store availability reserved.

## Scope and duplicate audit

New data: `src/data/retail-target-lowes-2026.ts`; English mapping: `src/data/retail-target-lowes-2026-en.json`. Exports `targetLowesOffers2026` (13 entries) and `targetLowesUpdates2026` (empty).

Compared working data and fetched `origin/main`, including `city-roundup-chain-offers.json`, `october-refresh-offers.ts`, `september-refresh-offers.json`, October/September offer files and brand matches across `src/data`. Existing `lowes-firefighting-plane-oct17` and `lowes-kids-lollipop` are already accurate. Do not duplicate them. `target-beauty-sep26` remains historical; do not change its September date to October.

Web text extraction often misses promotional images and delayed content. Target Store Events and Lowe’s MrBeast were therefore read in Chrome as rendered official pages. No login or CAPTCHA was completed. Public PDFs were read separately; the eos store PDF was extracted with pypdf after web extraction failed.

## Accepted entries

### Target: eos pouch with purchase — target-eos-pouch-oct10-2026

- Official event: https://www.target.com/c/eos-fall-scents-demo-event/-/N-s0gmo
- Official participating-store PDF: https://target.scene7.com/is/content/Target/GUEST_a3b29b09-6440-4ed2-ac4c-db8ae55a80e1
- Saturday October 10, noon–4 p.m.; ages 16+; while supplies last.
- The event image explicitly labels the regular-store pouch **giveaway with purchase**. It is a sherpa zip pouch alongside eos fall mist/lotion demonstrations. Classified `purchase`; not a no-purchase freebie. No nationwide gift count or minimum spend is published; confirm qualifying eos purchase with the store.
- Westbury, NY (999 Corporate Dr) alone advertises the personalized pouch and pumpkin-chai arrival latte. These extras must not be presented as Bay Area benefits.
- PDF header is “The Beauty Edit, October 10th, 12:00pm–4:00pm.” Bay Area examples: T0323 Cupertino 20745 Stevens Creek Blvd (p4); T0321 Redwood City 2485 El Camino Real (p8); T2768 SF 2675 Geary Blvd, T2088 San Jose 533 Coleman Ave, T1122 San Mateo 2220 Bridgepointe Pkwy (p9); T2584 Sunnyvale 298 W McKinley Ave (p10). Many other Bay Area stores are also listed.
- Confirmed event; individual store stock and any additional purchase exclusions are not tested.

### Target: ACOTAR midnight event — target-acotar-keychain-oct26-2026

- Official event: https://www.target.com/c/midnight-release-event/-/N-2jgu5
- Official participating-store PDF: https://target.scene7.com/is/content/Target/GUEST_c3aaad72-b28b-46e7-8b20-ca4a7a0e7dab
- October 26, 9 p.m.–midnight. First 100 guests receive a keychain and a ticket to purchase the book at midnight, while supplies last. Book purchase is separate; no membership/purchase prerequisite for the keychain is stated on the public page. Do not advertise a free book or free Starbucks drink.
- Bay Area stores explicitly listed: T0321 2485 El Camino Real, Redwood City; T2088 533 Coleman Ave, San Jose; T2804 950 Coddingtown Center, Santa Rosa.
- Preorder pickup orders become available after normal opening October 27, not at the midnight event.
- `endDate` retains October 26 as the announced event day; text explicitly says until midnight. Local queue/arrival arrangements should be confirmed.

### Target: Circle Deal Days — target-circle-deal-days-oct6-7-2026

- Primary source, news supplied by Target Corporation on September 15, 2026: https://www.prnewswire.com/news-releases/target-circle-deal-days-returns-with-major-savings-on-stylish-fall-and-holiday-finds-302878903.html
- October 6–7, free Circle membership; some offers have October 5 early access for paid Circle 360 members.
- Examples published: selected family apparel 40% off, selected skin/hair/cosmetics 30% off. Not storewide. In stores, app and online; local availability and exclusions vary.
- Classified `purchase`, not a gift. Ordinary free membership suffices during the main event.

### Target: new-member first-purchase discount — target-circle-new-member-oct5-2026

- Same Target-authored primary press release above.
- New members enrolling September 27–October 5 receive 15% off their first purchase. Existing members excluded; free enrollment but spending needed to use discount.
- October 5 is the eligibility/enrollment deadline. The press announcement does not supply a uniform redemption expiry. Data makes this distinction and sends users to their account coupon.
- Separate from the paid 360 and credit-card promotions in the same release.

### Target: Baby Registry welcome kit — target-baby-welcome-kit-2026

- Official help: https://www.target.com/help/article/000062588
- Free Circle + baby registry + ten distinct items + **more than $10** purchased from that registry by registrant or gift giver. “Over $10” is not “at least $10.”
- Allow 24–48 hours for account bonus; accept it and follow redemption. Online-only. Shipping and handling apply. One kit yearly.
- Active registry created after August 15, 2023; an already-redeemed earlier kit on the same registry makes that registry ineligible.
- Stated $100 value combines samples and Circle bonuses; not $100 cash or $100 full-size goods. No fixed contents promised.
- Classified `purchase` for the qualifying order; not a walk-in guest-service gift.

### Target: birthday discount — target-circle-birthday-discount-2026

- Official help: https://www.target.com/help/article/000071290
- Birthday in Circle profile; 5% discount issued on birthday, valid 30 days. Official page permits same-day issuance for enrolling on birthday.
- Find in App Wallet or Circle dashboard; exclusions and redemption details are account-offer specific.
- Classified `purchase`; no free item promised and no Circle Card application needed.

### Target: registry completion discount — target-registry-completion-discount-2026

- Official help: https://www.target.com/help/article/000062273
- Baby or wedding registry must be active at least 14 days before offer generation.
- Baby timing: eight weeks before expected arrival; wedding: event week.
- 15% discount, up to two redemptions, one offer per Circle member and one such offer in twelve months. Offer expires after six months. Save in Circle before shopping.
- Public help currently describes eligible in-store or online purchases; do not assert the outdated one-online/one-in-store limitation from secondary sources. Coupon exclusions still apply.
- Classified `purchase`, genuine relevant registry required; no suggestion to create fictitious events.

### Lowe’s: MrBeast Day — lowes-mrbeast-swarms-oct24-2026

- Official rendered page: https://www.lowes.com/l/creator/mrbeast
- Actual official banner asset: https://mobileimages.lowes.com/marketingimages/f7219630-3ad9-4d90-85e8-14230ec50cbd/mrbeast-hero-dp18-1276909.png
- Banner says October 24 is MrBeast Day. First 100 MyLowe’s Rewards members in store get two free Lowe’s-exclusive Swarms. Current October 2026 context; public image itself omits year.
- The same banner advertises $5 off MrBeast kits and 10% off MrBeast apparel that day. Included as separately identified optional purchases in description, not additional guaranteed free gifts.
- Start time is **not** shown. No age limit or separate child-profile requirement is shown for the two free Swarms. Data does not invent either. Ask chosen Bay Area store about event participation, start and inventory.
- Public national event; no per-store stock calls made. Current page happened to display San Bruno Lowe’s in store selector, which does not by itself prove a local allocation.
- Workshops FAQ describes paid MrBeast workshop kits and ages 8+ recommendation. Do not apply those distinct paid-workshop conditions to this giveaway.
- Raw web indexing missed banner; Chrome rendered DOM and screenshot were the authoritative observation. No screenshot/image was synthesized.

### Lowe’s: published future free Kids Workshops

- Official calendar + FAQ: https://www.lowes.com/diy-projects-and-ideas/workshops
- `lowes-holiday-engine-nov14-2026`: November 14, 2026, 10 a.m.–1 p.m.; registration opens October 10. Booking: https://www.lowes.com/events/register/holiday-engine
- `lowes-holiday-trolley-dec12-2026`: December 12, 2026, 10 a.m.–1 p.m.; registration opens November 14. Booking: https://www.lowes.com/events/register/holiday-trolley-car
- `lowes-winter-play-lodge-jan16-2027`: January 16, 2027, 10 a.m.–1 p.m.; registration opens December 12, 2026. Booking: https://www.lowes.com/events/register/winter-play-lodge
- All three are already named on the official calendar as of October 4, but none is yet open for booking. Do not imply an available Bay Area reservation.
- Free monthly Kids Workshops need Rewards, a Kids Profile and preregistration. Recommended ages 4–11, adult supervision. Typical 30–45-minute build within event window; slots and kit capacity vary locally.
- Paid special events exist (notably MrBeast kits); the calendar entries must not become a blanket statement that every Lowe’s workshop is free.
- Existing October 17 firefighting plane entry retained, not duplicated.

### Lowe’s: Senior Builder tool bag — lowes-senior-builder-toolbag-2026

- Official current terms linked from Kids Club FAQ: https://www.lowes.com/pdf/diy-u_kids_workshops_terms.pdf
- Terms edited July 1, 2025 but program expressly continues through December 31, 2026, so not an expired 2025-only offer.
- Children 4+; U.S. personal-account parent/guardian; 12 completed qualifying workshops and physical badges. Submit apron photo for validation. Free Kobalt children’s tool bag or equivalent substitution, supplies permitting, shipping included.
- Current FAQ says digital and MrBeast badges do not count. Recognition and claim should finish by program end; new 2027 prizes not yet announced.
- For previously participating families. Three remaining months do not let a new member earn twelve monthly badges; data explicitly says it is not an immediate signup gift.
- Terms contain inconsistent wording about the earliest qualifying workshop dates. Do not promise a specific historical badge will count; let Lowe’s validate the actual collection.

### Lowe’s: member-gift discovery — lowes-member-gifts-check-local-2026

- Official public overview: https://www.lowes.com/l/savings/coupons
- Member events destination: https://www.lowes.com/mylowes/profile/wallet/promotions/member-events
- Public page confirms occasional free member gifts. Free Rewards membership does not require a credit card.
- `availability: 'check-local'`; no specific bucket, magnet, tote, date or value promised. User must check current account event and local store. Signing up does not guarantee an immediate gift.

## Investigated but not accepted as confirmed Bay Area offers

| Candidate | Evidence and decision |
|---|---|
| Lowe’s mini bucket magnets / MyLowe’s Money Days, October 10–11 | Third-party current leads at https://thefreebieguy.com/lowes-freebies/ and an October 1 Absolute Shopping Community listing identify magnets, Money and a 10 a.m. start. Following the source’s official affiliate redirect led to the member-events URL above, which requires sign-in. Public homepage, Rewards, coupons, MrBeast, workshops, corporate search and official-domain/PDF searches did not yield a current public rule or image establishing the gift quantity or exact terms. **Not published as confirmed**, not silently replaced with a different event. Follow-up requires official account event notice or current store-published rules. |
| Lowe’s October 31 candy / trick-or-treat giveaway | Searched official site and corporate newsroom for October 2026, October 31, Halloween giveaway/candy; results were Halloween merchandise and decorating articles, not event rules. No current official date/time/age/quantity proof retrieved. **Not added.** This does not assert the event cannot happen. |
| Lowe’s October 3 tote | Contemporary third-party lead, already past as of review. No refresh to future October. **Excluded from current additions.** |
| Lowe’s public MyLowe’s Money Days landing page | https://www.lowes.com/mylowesmoneydays rendered July 2026 promotional dates (including July 9–12 in explanatory image and a July 26 end elsewhere). It cannot substantiate October 10–11. **Excluded as October evidence.** |
| Lowe’s 2025 giveaway PDFs | May 2025 and January 2025 official giveaway PDFs surfaced. Wrong period. **Excluded; not used to infer 2026 limits.** |
| Lowe’s ordinary mini-bucket merchandise | Normal pink 0.4-quart bucket product is retail merchandise, not proof of a free magnet event. **Excluded.** |
| Lowe’s $5 signup headline | Site navigation advertises “Get $5 off when you join,” but a complete public current qualifying-purchase rule was not obtained. **Not turned into a guaranteed $5 free item.** Can investigate as a separate purchase coupon later. |
| Target Liquid I.V. October 4 kit | Official https://www.target.com/c/liquid-iv-oct-name-tbd/-/N-lixwt says noon–4 p.m., age16+, sample stick/recipe/stirrers while supplies last. PDF https://target.scene7.com/is/content/Target/GUEST_df27f8f8-51af-4438-a829-caf89ef669f8 has **no Bay Area stores**: its CA list is Canoga Park, Carson, Fontana, Menifee, Rancho Cucamonga, Redlands, Tulare, Visalia and Westminster. **Excluded from Bay Area collection**, despite nationwide social posts. |
| Target Beauty Studio sample box | https://www.target.com/c/target-beauty-studio-event/-/N-140b1 still says September 26 noon–4 p.m. Select stores had first-100 sample boxes, most stores Circle offer; age16+. **Expired; existing history retained.** September launch of Beauty Studio does not promise a recurring monthly full box. |
| Target Threshold styling event | Official Store Events banner is for Maple Grove North, Minnesota. **Not a Bay Area event.** |
| Target paid Circle 360 signup / card offer | Same September 15 press release advertises $50 Circle rewards for new annual 360 signup (September27–October10), with $99 annual membership or $49 for qualifying audiences; separate $75 credit-card approval reward. These are paid membership / financial-product offers, not free enrollment gifts. **Not added to this freebie set.** |
| Target online “free samples” generic claims | No current public official blanket request-any-sample scheme established. **Not added.** Actual eos buy-with-purchase event is covered instead. |

## Assets and integration

For compilable data, existing valid GUIDE_IMAGES keys are used with explicit original-illustration notes. No old September product photo is passed off as a new October gift. The official MrBeast banner URL above can support a new clearly credited promo-media key; root may replace placeholder media when integrating.

The accepted offer wording and all Chinese display fields have sentence-level English mappings in the new JSON. Updates export is intentionally empty: existing brand entries are correct or historical, so no artificial re-verification date was added to expired offers.

## Useful next checks

1. Obtain official October 10–11 member-event notice; verify date, local start, magnet quantity, any random-prize structure, membership and age rules before publishing a dated bucket card.
2. Look for a newly published October 31 official event page or current Bay Area store announcement.
3. Shortly before October 10, confirm eos qualifying purchase and local pouch supply; do not add NY extras.
4. Before October 24, confirm MrBeast start time and any store-specific queue procedure; the public banner currently does not settle them.
5. On workshop registration-opening dates, select actual Bay Area stores to establish whether reservable capacity exists. This research did not sign users up.
