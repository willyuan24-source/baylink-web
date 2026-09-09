# Loan calculator release — 2026-09-08

The existing life toolbox now includes `/tools?tool=loan#tool-workspace`, accessible without signing in. Users can start with a home price and down payment (percentage or dollars), or enter a loan principal directly. The six-tool picker uses three columns on desktop and two on phones.

## Calculation and scope

- Fixed nominal annual interest, monthly amortization, whole-year terms from 1 to 50; zero interest and zero principal are supported. Interest rate is not APR.
- Monthly principal and interest are separate from optional annual property tax, annual homeowner insurance, monthly HOA and mortgage insurance. Blank optional costs count as zero; switching to direct-principal mode excludes all housing costs.
- Extra principal is applied every month starting with the first payment, without reducing the regular scheduled payment. Comparison shows interest saved and months saved, plus annual remaining-balance curves and an accessible annual table.
- All cash flows use integer cents. Per-period interest uses exact half-up rounding; monthly formula payment is rounded to cents, with a one-cent minimum for positive principal. The final payment settles the remaining balance and is always shown; an upward adjustment exceeding $1 is also called out in the page and copied summary. Extreme long-term/high-rate rounding cases are explicitly covered by tests.
- No rate quotes, approval assessment, closing fees, prepayment penalties, future tax/insurance changes, adjustable rates, interest-only terms or daily-interest products are modeled. The preset is labeled an illustration, not a current quote. Mortgage insurance eligibility/cancellation is not inferred.
- Calculation inputs stay in component memory and are not persisted or sent to an API. Copying requires a user action. No backend, account or live-post changes are required.

## Validation

- `npm run check`: 128 tests passed; lint has 0 errors and 44 existing warnings; TypeScript, production build and 48-page prerender passed.
- Nine calculation tests cover the standard amortization formula, zero/very low interest, tiny and maximum amounts, input validation, conservation of cents, prepayment and final adjustments.
- Eight UI tests cover the sample, direct-principal mode, down-payment unit changes, invalid and zero values, extra payments, year selection/table, clear, clipboard success/failure and explicit final-payment amounts in copied output.
- Chrome desktop and 390 × 844 mobile checks: the $1,000,000 price / 20% down / 6% / 30-year sample yields $4,796.40 monthly principal and interest; with $12,500 annual property tax and $1,800 annual insurance the monthly housing budget is $5,988.07. Adding $500 principal monthly yields $6,488.07 planned monthly outlay, $232,113.19 estimated interest savings and payoff 6 years 5 months earlier.
- Mobile chart, fields and expanded annual table were visually checked. Table overflow is confined to its scroll region; the page does not overflow horizontally.

## Reference review

The scope labels were checked against CFPB explanations:

- [Interest rate versus APR](https://www.consumerfinance.gov/ask-cfpb/what-is-the-difference-between-a-mortgage-interest-rate-and-an-apr-en-135/)
- [Principal and interest versus total monthly payment](https://www.consumerfinance.gov/ask-cfpb/on-a-mortgage-whats-the-difference-between-my-principal-and-interest-payment-and-my-total-monthly-payment-en-1941/)
- [Prepayment penalties](https://www.consumerfinance.gov/ask-cfpb/what-is-a-prepayment-penalty-en-1957/)

Deployment uses the existing frontend GitHub/Vercel integration. The production receipt is written under ignored `output/` after the actual deployment is verified.
