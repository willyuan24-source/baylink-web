# Birthday perks verification — 2026-10-04

Internal editorial evidence for BAYLINK. Review date uses America/Los_Angeles. The supplied Instagram collage is visual inspiration, not evidence for an offer. Only official brand pages are used below. No future-dated articles are used.

## Deliverables and integration

- `src/data/birthday-perks-2026.ts` exports nine reviewed offers in `birthdayPerks2026`, plus a `birthdayPerkUpdates2026` patch for `sephora-birthday`. Against the October 4 production baseline, five of those nine already exist; their published canonical IDs are preserved and updated. Four are new to production.
- `src/data/birthday-perks-2026-en.json` provides all 55 Chinese-to-English display-string mappings.
- All offers are recurring birthday benefits, not October-only promotions. Each has `verifiedAt: '2026-10-04'`, an official terms link and a store lookup/local store link.
- Apply the Sephora patch to the existing offer; do not create a duplicate.
- Starbucks, Jersey Mike’s and Red Robin children’s discount are deliberately `kind: 'purchase'`. Past purchases still count as a purchase condition.
- Existing generic editorial imagery is labeled as such. It must not be used to imply a real reward size, SKU or local inventory.

## Official evidence

| Brand / offer ID | Verified benefit and critical conditions | Official evidence | Bay Area lookup |
| --- | --- | --- | --- |
| Sephora / `sephora-birthday` (update) | One gift per year during birthday month. Beauty Insider email in store, no purchase. Online: $25 qualifying merchandise. No guaranteed SKU or extra weeks outside the month. | [Birthday gifts](https://www.sephora.com/beauty/birthday-gift), [Beauty Insider FAQ](https://www.sephora.com/beauty/loyalty-program) | [Emeryville](https://www.sephora.com/happening/stores/emeryville?storeId=0116) |
| Ulta / `ulta-birthday-2026` | Birthday month in-store gift with coupon, no purchase. Birthday and marketing opt-in before the month. Online and pickup require qualifying non-Marketplace merchandise subtotal greater than $0; online shipping may apply. | [Birthday page](https://www.ulta.com/rewards/birthday-gift), [terms revised 2026-08-16](https://www.ulta.com/rewards/terms-and-conditions) | [Official directory](https://www.ulta.com/stores/directory) lists San Jose, Sunnyvale and San Mateo |
| Dutch Bros / `dutch-bros-birthday-2026` | Birthday drink reward, 30 days. Existing app user receives reward on birthday; downloading on birthday gives reward the next day. Redeem by scanning Dutch Pass. No prior-purchase prerequisite listed. | [Rewards FAQ](https://www.dutchbros.com/rewards/) | [California directory](https://www.dutchbros.com/locations/ca) lists Concord and Brentwood |
| Nothing Bundt Cakes / `nothing-bundt-cakes-birthday-2026` | Free individual Bundtlet for Bundtastic Rewards members, 18+, phone and active email. FAQ says birthday email usually arrives about a week before, usable from receipt through seven days after birthday. Account reward expiry should still be checked. No fixed advance signup deadline stated. | [FAQ](https://www.nothingbundtcakes.com/faqs/), [Rewards](https://www.nothingbundtcakes.com/bundtastic-rewards/) | [San Jose bakeries](https://www.nothingbundtcakes.com/find-a-bakery/ca/sanjose/) |
| Chick-fil-A / `chick-fil-a-birthday-2026` | Basic One member: cookie or brownie. Add birthday at least 24 hours before, latest app. Valid 30 days; Sunday birthdays receive reward Saturday. Higher-tier entrée choices are not a base-member entitlement. | [Tier choices](https://www.chick-fil-a.com/customer-support/chick-fil-a-one-membership-program/creating-and-managing-your-account/what-is-the-birthday-reward-for-each-membership-tier), [eligibility](https://www.chick-fil-a.com/customer-support/chick-fil-a-one-membership-program/creating-and-managing-your-account/its-my-birthday-and-i-didnt-get-a-reward-on-my-account), [30-day window](https://www.chick-fil-a.com/customer-support/chick-fil-a-one-membership-program/creating-and-managing-your-account/how-long-can-i-use-the-birthday-reward) | [Sunnyvale](https://www.chick-fil-a.com/locations/ca/sunnyvale), closed Sundays |
| Panera / `panera-birthday-2026` | Basic MyPanera: one eligible bakery treat, no purchase; birthday must be in account. Valid seven days from loading, price cap as stated on reward, must select reward when ordering. Delivery has separate minimums/fees. Higher-tier meals are not universal. | [Terms last updated 2026-08-19](https://www.panerabread.com/en-us/legal/terms-of-use.html), MyPanera Tier / Birthday Reward subsection | [Official café locator](https://www.panerabread.com/en-us/cafe/locations); do not rely on lookalike “near me” domains |
| AMC / `amc-birthday-popcorn-2026` | Free Insider: large ordinary popcorn in birthday month. Enroll and add birthday at least 30 days before month’s first day (FAQ); terms also require a calendar month of active enrollment. Additional large fountain drink is higher-tier only. Ticket is not included. | [Stubs FAQ](https://www.amctheatres.com/faqs/amc-stubs), [Stubs terms](https://www.amctheatres.com/amcstubs/terms-and-conditions), [free Insider](https://www.amctheatres.com/amcstubs/insider) | [Official Bay Area theatre list](https://www.amctheatres.com/movie-theatres/san-francisco), including NewPark 12 / Sunnyvale 12 |
| Starbucks / `starbucks-birthday-2026` | Join at least seven days before birthday, add birthday, at least one Star-earning transaction before birthday each year. One eligible drink/food. Green: birthday only; Gold: seven days from birthday; Reserve: 30 days. | [Terms effective 2026-03-10](https://www.starbucks.com/terms/rewards/), Additional Benefits / Birthday Reward | [Official store locator](https://www.starbucks.com/store-locator), participating stores only |
| Jersey Mike’s / `jersey-mikes-birthday-2026` | 72 Shore Points on birthday if MyMike’s profile and email opt-in completed beforehand and account bought a Regular/Giant Sub, Wrap or Sub Bowl in previous 12 months. Point redemption does not count. 72 points redeems base Regular, Wrap or Bowl; modifications extra. | [Terms updated 2026-09-22](https://www.jerseymikes.com/rewards/terms-conditions) | [San Jose, 1088 E. Brokaw Road](https://www.jerseymikes.com/20220/san-jose-ca) |
| Red Robin / `red-robin-kids-birthday-2026` | Child age 17 or younger, birthday entered in parent’s Royalty profile, child present, dine-in, one $7 discount in birthday month with minimum $4.99 accompanying purchase. Standard adult birthday burger discontinued into personalized offers. | [Terms version 2026-06-01](https://www.redrobin.com/royalty/terms), [FAQ](https://www.redrobin.com/faq) | [San Bruno](https://www.redrobin.com/locations/ca/sanbruno/san-bruno-193) |

## Corrections to avoid in social graphics

1. Do not headline every card “FREE” without showing enrollment and purchase conditions.
2. Do not promise a Starbucks birthday-month window to Green members.
3. Do not advertise a Jersey Mike’s sandwich to someone with no qualifying purchase in the prior year.
4. Do not promise an adult Red Robin birthday burger for October 2026. Transition relief only covers qualifying members whose birthday month began on or before July 1, 2026.
5. Do not use Sephora’s prior-year gift image as a promise of current store inventory, or guarantee a two-week grace period.
6. Do not present a generic “free Chick-fil-A sandwich” to base-tier members.
7. Do not say AMC birthday popcorn includes a ticket or that basic Insider includes a drink.
8. New-account offers and birthday rewards are different. The collage’s advice about multiple email accounts is not adopted.

## Retrieval notes

- A search result for Jersey Mike’s surfaced `jerseymikees.com` (extra “e”). It was rejected. All implemented links use `jerseymikes.com`, whose current terms were directly opened and inspected.
- Nothing Bundt Cakes’ main rewards page gives generic expiry wording; the directly opened current FAQ supplies the email-to-seven-days-after window. This is not inferred solely from an old eClub search snippet.
- Some official pages are client-rendered or enter a queue intermittently. AMC’s location direct-open queued, while its official indexed theatre list and the FAQ/terms were available. No showtime claims were added.
- Panera’s source text was available in the official indexed terms result even though one follow-up deep-line open failed. The date and base-tier bakery reward are explicitly present in that official result.
