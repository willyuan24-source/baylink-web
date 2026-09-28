# Everyday home services and preparedness guides

Verification date: 2026-09-27, America/Los_Angeles. Two evergreen guides, with no monthly edition. The text navigates official services and supports advance preparation; it does not perform registrations, submit personal information, claim current outage/AQI conditions or provide hazardous-material handling instructions.

## Bulky items, electronics and household hazardous waste

Successfully opened and read:

- [Recology SF bulky collection FAQ](https://www.recology.com/recology-san-francisco/residential-curbside-collection/) — eligibility depends on an active residential/apartment account, with housing-type distinctions. Bookings are required. The guide avoids copying pickup allowances or claiming universal free service.
- [Recology SF hazardous waste](https://www.recology.com/recology-san-francisco/hazardous-waste/) — separate HHW routing, accepted-material restrictions, and staff guidance for unknown/unlabeled material. The guide does not reproduce handling, repackaging or transport instructions from this page.
- [San Mateo County Health HHW](https://www.smchealth.org/hhw) — successfully redirected to the county's new program page. County household eligibility and advance appointments are distinct from city bulky pickup. Older indexed FAQ text shows historical limits and availability promises; these are not copied.
- [Santa Clara County household drop-off](https://hhw.santaclaracounty.gov/drop-household-waste) — appointments, residency proof and the explicit Palo Alto city-program exception. The facility address may be provided after booking. Business material has separate routing.
- [StopWaste recycling and disposal](https://www.stopwaste.org/recycling-disposal) — Alameda County resident HHW facilities; permanent facilities do not require appointments, but current days and item acceptance must still be checked.
- [StopWaste accepted HHW](https://www.stopwaste.org/recycling-disposal/hazardous-waste/household-hazardous-waste/whats-accepted) — household-only eligibility and separate business/landlord services support the distinction from general hauling.
- [Marin HHW](https://marinhhw.com/) — residential and business services, accepted/nonaccepted materials and dates. A guessed `/residential/` path failed; it is not used as a source or user link.
- [Novato Sanitary District HHW](https://novatosan.com/services/household-hazardous-waste-program/) — separate local facility and calendar. Its page says residential appointments are unnecessary but dates vary. The guide uses the live calendar rather than freezing specific days or dates.

Also read official operator search-index text from [Marin Sanitary Service support](https://marinsanitaryservice.com/support/) and [Marin Resource Recovery Center](https://marinresourcerecoverycenter.com/) to corroborate the Marin/Novato service distinction. These were not needed to meet the successfully opened source count. No scope is generalized to Sonoma, Napa, Contra Costa or other counties.

## Local alerts, outages and first-day preparedness

Successfully opened and read:

- [AlertSF](https://www.alertsf.org/) — resolved to its Everbridge membership portal; registration was not performed. Official SF government indexed material also identifies this as the city's alert entry point.
- [Alameda County Health AC Alert](https://health.alamedacountyca.gov/alerts-announcements/ac-alert/) — resolved from `/ac-alert/`; supports the county-level alert system and official registration routing. The old acgov emergency page returned only a redirect, so the guide uses the new county-health page.
- [SMC Alert](https://www.smcgov.org/dem/smc-alert) — opt-in contact methods and address-based notifications. No promise that registration guarantees delivery is made.
- [AlertSCC](https://oem.santaclaracounty.gov/sign-up-for-alerts) — resolved from an older `/prepare-4-steps/register-alerts` page. Supports registration, saved locations and preference updates. Platform-specific click sequences, short codes and delivery-language guarantees are omitted.
- [Marin emergency alert tools](https://marinsheriff.gov/emergency-services/emergency-alert-and-warning-tools) — AlertMarin and geographic coverage. It is not represented as a system for the entire North Bay.
- [PG&E outages and safety](https://www.pge.com/en/outages-and-safety.html) — official outage viewing, reporting and update routing. No live outage status is asserted.
- [Air District current air quality](https://www.baaqmd.gov/About-Air-Quality/Current-Air-Quality) — distinguishes monitoring information from forecast/Spare the Air status. Cached widget dates are not used as today's conditions.
- [Air District Spare the Air](https://www.baaqmd.gov/about-air-quality/spare-the-air/?sc_lang=en) — alert subscriptions and program information. No medical thresholds or personal health advice appear in the guide.

Official indexed material read, with direct-open limitations:

- [Silicon Valley Power outages](https://www.siliconvalleypower.com/svp-and-community/outages-and-alerts) — direct open returned 403. Indexed utility text supports the City of Santa Clara's separate outage service; hotline numbers and current outages are not copied.
- [Palo Alto Utilities outages](https://www.paloalto.gov/Departments/Utilities/Utilities-Services-Safety/Outages) — direct open returned 403. Official indexed outage and customer-notification pages support separate city utilities routing. No live map totals are reproduced.
- [Ready.gov kit](https://www.ready.gov/kit) and [Ready.gov homepage](https://www.ready.gov/) — direct opens failed with an internal fetch error, not a confirmed 403. The official indexed homepage links kit and communication-plan resources.
- [FEMA Ready emergency-supply checklist](https://www.fema.gov/sites/default/files/documents/fema_hm-emergency-supply-kit-checklist_english.pdf) — official search-index text was read; direct PDF open failed. Supports water, shelf-stable food, charging, radio, flashlights and household-specific supplies. The guide does not specify quantities, survival guarantees or technical safety procedures.
- [Ready.gov preparedness toolkit](https://www.ready.gov/sites/default/files/documents/files/RRToolkit.pdf) — official indexed text supports an out-of-town contact, meeting arrangements and household/pet supplies. Old details such as prepaid calling cards are not carried into the guide.

The official Ready.gov link is retained as the user-facing checklist destination. Navigation remains useful even where this research tool could not directly fetch a page. The guide has more than four successfully opened official sources independently of the indexed-only resources.

## Localization and integration

- `src/data/guides-daily-home.ts` exports `dailyHomeGuides: Guide[]`.
- `src/data/daily-home-en.json` contains all 89 exact Chinese-string keys, including titles, tags, source descriptions, paragraphs, checklists, templates and action text.
- A TypeScript AST audit found 89 Chinese strings, 89 translated keys and no missing translations.
- Both guides carry the shared `日常办事` tag. Shared registries, navigation, media and whole-project checks are handled by the coordinating task.
