# Retirement and naturalization content — October 6, 2026

Two practical guides fill separate long-term-resident needs: preparing for Social Security retirement, and locating the official naturalization route. These pages provide agency links, document preparation and consultation questions. They do not decide individual eligibility, benefit amounts, immigration outcomes or the best claiming age.

## Source evidence and limits

The following SSA pages were read directly on October 6, 2026:

- [Work credits](https://www.ssa.gov/benefits/retirement/planner/credits.html): retirement credits and the annual maximum; credits are distinct from benefit amounts.
- [Benefit estimates](https://www.ssa.gov/prepare/get-benefits-estimate): personalized account estimates and earnings records.
- [Retirement planning](https://www.ssa.gov/retirement/plan-for-retirement): claiming timing, work, taxes and separate family-benefit timing.
- [Full retirement age](https://www.ssa.gov/benefits/retirement/planner/ageincrease.html): birth-year calculator.
- [First payment timing](https://www.ssa.gov/retirement/timing-first-payment): up to four months before enrollment; first payment follows the selected month.
- [SSI](https://www.ssa.gov/ssi): limited income/resources plus age or disability/blindness conditions, subject to other rules.
- [Interpreter services](https://www.ssa.gov/multilanguage/interpreter.html): free telephone/office interpreters and the official telephone number.

USCIS direct access to the N-400, eligibility, exceptions, interview/test and legal-services pages returned 403 or an inaccessible response. Direct PDF access also failed. Official USCIS documents were available through search-indexed text. This is evidence for a cautious overview, **not a successful full-page/current-edition verification**:

- [N-400 instructions](https://www.uscis.gov/sites/default/files/document/forms/n-400instr.pdf): general eligibility, spouse route and required evidence. The retrieved index displayed an older edition; the current edition and current rules must be confirmed through [N-400](https://www.uscis.gov/n-400) before submission.
- [Naturalization pathway](https://www.uscis.gov/sites/default/files/document/guides/M-685.pdf): permanent-resident years and application/interview/oath stages.
- [2025 civics questions](https://www.uscis.gov/sites/default/files/document/questions-and-answers/2025-Civics-Test-128-Questions-and-Answers.pdf): version-specific 128-question pool, up to 20 oral questions and at least 12 correct for the standard test, with separate 65/20 consideration. The guide does not infer which filing date or applicant must take this version; readers must check the [interview/test page](https://www.uscis.gov/citizenship/find-study-materials-and-resources/the-naturalization-interview-and-test).
- [Age 50+ fact sheet](https://www.uscis.gov/sites/default/files/document/fact-sheets/Fact-Sheet-Promoting-Citizenship-for-50-and-Older.pdf): age **and** permanent-resident years determine English exceptions; civics remains separate.
- [USCIS scam-prevention flyer](https://www.uscis.gov/sites/default/files/document/flyers/AvoidScamsFlyerAfghanNationalsEn.pdf): authorized attorneys and DOJ-recognized/accredited representatives, protection of identity information, and no guaranteed outcomes. Legal-services availability, charges and Chinese support are questions for the provider, not site promises.

The public source note and descriptions preserve these access limits. No annual dollar threshold, fee, benefits projection, processing-time promise or personal legal conclusion is published. No user documents or government accounts were accessed.

## Integration and review

- Import `benefitsCitizenshipGuides` from `src/data/guides-benefits-citizenship.ts` into the main guide catalog.
- Add `src/i18n/../data/guides-benefits-citizenship-en.json` to `scripts/english-sources.json`, then regenerate the complete/scoped English dictionaries and site catalog. Traditional Chinese uses the established editorial conversion.
- Use existing generic, attributed, non-text context media. Do not reuse an illustration printed with Medicare or tax instructions for these unrelated services.
- In the editorial review manifest, treat both guides as health/legal/financial content with a 30-day cadence. Put `bay-area-naturalization-official-path-guide` in manual review until a person reads the current USCIS pages and form edition. The edited date is not a renewed full-source verification date.
- Run `tests/benefits-citizenship-guides.test.ts` in the release test suite. Its checks protect the complete English coverage, official-only sources, source-access disclosure and version/timing boundaries. No Node test was run by the content subagent while the root release suite was active.
