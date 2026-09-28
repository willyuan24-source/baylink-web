# Daily community guides: source review

Reviewed September 27, 2026. This note records the evidence used for the two evergreen guides in `src/data/guides-daily-community.ts`. English strings are in `src/data/daily-community-en.json`. Dates, registration windows, prices, operating hours, class capacity and program eligibility are deliberately not generalized across providers.

## Adult English and continuing learning

The following primary pages were opened and their page text read:

- [CCSF noncredit admission](https://www.ccsf.edu/admissions-recordsregistration/noncredit-admission): tuition-free noncredit admission has its own eligibility conditions, including current California residence and age-related rules. Admission, placement and class registration are separate steps. The guide does not substitute Free City credit-program rules or give individual immigration eligibility advice.
- [CCSF steps to take noncredit ESL classes](https://www.ccsf.edu/academics/schools/esl-international-ed-and-transitional-studies/english-second-language/steps-to-take-noncredit-ESL-classes): application/account, placement and registration steps, with campus and online learning options.
- [Oakland Adult & Career Education enrollment](https://www.ousd.org/adult-and-career-education/enrollment): current enrollment and registration instructions. [The ESL program page](https://www.ousd.org/adult-and-career-education/classes/esl-college-career-readiness-pathways) was also read for adult and leveled classes and the separate family-literacy pathway. Time-limited registration dates and potentially inconsistent legacy term wording were not copied into the guide.
- [San Mateo Adult & Career Education homepage](https://sanmateoadulted.org/): current school identity, course-catalog and office entry points. [The current catalog](https://sanmateoadulted.org/course-catalog/) was also opened. The guide directs prospective students to ask about the current ESL intake; it does not claim a particular class is accepting students or that every course is free. The older `/esl/` path failed to load in the research tool and was not used as evidence. An indexed older PDF was not used for current dates or fees.
- [Santa Clara Adult Education ESL](https://www.santaclaraadulted.org/esl/): free adult English classes, registration-associated orientation and placement, and textbook information. The guide distinguishes tuition from possible materials and travel costs and does not repeat a dated intake window.
- [College of Marin ESL placement process](https://ss.marin.edu/esl-placement-process): noncredit and credit pathways, placement/counseling and registration, possible transportation fees, and space-available noncredit enrollment in some higher-level classes. Waitlist/first-day instructions vary by class and must be confirmed.

Editorial advice covers choosing an achievable commute and schedule, asking about books/materials/parking and other fees, verifying actual enrollment rather than an interest form, and following up on waitlists. These are planning suggestions, not promises that every school uses the same process. The inquiry template uses only placeholders and does not request identity-document numbers.

## 311, 211 and emergency help

Fully opened and read primary or nonprofit-operator pages:

- [California Public Utilities Commission: 211 counties in the Bay Area](https://www.cpuc.ca.gov/industries-and-topics/internet-and-phone/211-information-services/2-1-1-counties-in-the-bay-area): county-to-provider directory. This supports choosing by county rather than assuming a single provider across the region.
- [United Way Bay Area: get help](https://uwba.org/get-help/): 211 information/referral, basic-needs categories and the regional directory. Referral does not guarantee eligibility, availability or free service from a referred organization.
- [211 Alameda County: what 211 does](https://211alamedacounty.org/about-us/what-211-does/): non-emergency referrals versus 911 for life-threatening medical, fire and police emergencies; needs/location information and confidential consultation.
- [211 Alameda County: contact 211](https://211alamedacounty.org/find-help-information/contact-211/): alternate contact methods, a complete telephone number for short-code connection problems, and different arrangements for telephone, text and email. The guide deliberately does not promise identical service hours across channels or counties.
- [211: find your local 211](https://211.org/about-us/your-local-211): location-based national provider lookup, used as corroborating context.

Municipal primary pages were researched through their official indexed text, but direct page extraction was restricted or failed. This is limited verification of the specific indexed statements, not a successful full-page inspection:

- [SF.gov: get information from 311](https://www.sf.gov/get-information-311): official indexed content distinguishes 311 calls inside San Francisco from its complete outside-city number and describes non-emergency city information. Direct extraction returned an anti-bot response; the `/311` alternative also failed in the tool. No opening hours, language count or specific full telephone number is reproduced.
- [San José 311](https://www.sanjoseca.gov/your-government/departments-offices/customer-service/san-jos-311): official indexed text supports submitting and tracking city service requests through the website/app. Direct extraction failed. The guide does not make a broad short-code telephone claim or copy telephone hours.
- [Oakland: report an issue with OAK311](https://www.oaklandca.gov/My-Household/Report-an-Issue-OAK-311): official indexed text distinguishes ordinary online requests from currently occurring infrastructure emergencies, for which it directs callers to telephone service. Examples include flooding and fallen trees/branches. Direct extraction failed. The guide separately sends immediate threats to people to 911 and does not tell readers to wait for a web request in an emergency.

[211 Bay Area](https://211bayarea.org/) was available in official indexed content and linked by United Way Bay Area, but direct extraction failed. It is supplied as an action directory, corroborated by the operator page and CPUC county directory; access failures here are not evidence that the public website is unavailable to users.

Editorial reporting advice recommends a precise public location, observed impact, safe public-facility photographs, no private information in public descriptions, and saving the request number for follow-up. This does not claim all municipal reports are confidential or that a referral means a case is resolved. Templates contain only placeholders; no personal information is collected by these guides.

## Content checks

Both guides use the shared `日常办事` tag, contain three section headings, a regional/action list, one copyable template, four checklist items, official action links and a guides CTA. `updatedAt` records this source review date; neither guide uses an edition month or asserts continuing class/service availability. Dictionary coverage and structural validation were checked locally; site integration and broader tests are handled by the parent task.
