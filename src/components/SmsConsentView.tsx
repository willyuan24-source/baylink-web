import { LegalPageLayout, LegalP, LegalSection, LegalUl } from './LegalPageLayout';

const OPT_IN_STEPS = [
  'Step 1: Log in to BAYLINK',
  'Step 2: Open Profile → Phone Verification',
  'Step 3: Enter mobile number',
  'Step 4: Click “Send verification code”',
  'Step 5: Receive one-time verification code',
];

export const SmsConsentView = () => (
  <LegalPageLayout title="BAYLINK SMS Verification Consent" updated="May 2026">
    <LegalP>
      This page describes how users opt in to receive SMS messages from BAYLINK for phone verification and account security. It is provided for transparency and A2P campaign review purposes.
    </LegalP>

    <LegalSection title="What SMS messages BAYLINK sends">
      <LegalP>
        BAYLINK sends one-time SMS verification codes only for account security and phone verification. BAYLINK does not send marketing or promotional SMS messages.
      </LegalP>
      <LegalP>
        SMS is sent only after the user actively requests a verification code. Message frequency varies based on verification requests. Msg &amp; data rates may apply.
      </LegalP>
    </LegalSection>

    <LegalSection title="How users opt in">
      <LegalP>Users opt in by completing the following steps inside BAYLINK:</LegalP>
      <LegalUl
        items={[
          'Log in to BAYLINK.',
          'Open Profile and select Phone Verification.',
          'Enter their mobile phone number.',
          'Click “Send verification code”.',
          'Receive a one-time verification code by SMS.',
        ]}
      />
      <LegalP>
        No SMS is sent until the user enters a mobile number and clicks “Send verification code”. Consent is not collected on a separate public form; it is collected at the point of verification inside the logged-in profile flow.
      </LegalP>
    </LegalSection>

    <LegalSection title="Opt-out and help">
      <LegalP>Reply STOP to opt out. Reply HELP for help.</LegalP>
      <LegalP>
        For support, contact:{' '}
        <a href="mailto:Baylink.us@gmail.com" className="font-medium text-baylink-green hover:underline">
          Baylink.us@gmail.com
        </a>
      </LegalP>
    </LegalSection>

    <LegalSection title="Privacy and terms">
      <LegalP>
        <a href="/privacy" className="font-medium text-baylink-green hover:underline">
          Privacy Policy
        </a>
        {' · '}
        <a href="/terms" className="font-medium text-baylink-green hover:underline">
          Terms of Service
        </a>
      </LegalP>
    </LegalSection>

    <LegalSection title="Reviewer screenshots / Opt-in flow">
      <LegalP>
        The screenshots below illustrate the in-app opt-in flow. Placeholder cards are shown until production screenshots are added.
      </LegalP>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {OPT_IN_STEPS.map((step, index) => (
          <div
            key={step}
            className="rounded-2xl border border-dashed border-baylink-border bg-baylink-section/40 p-4"
          >
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-baylink-muted">
              Placeholder
            </div>
            <div className="flex h-28 items-center justify-center rounded-xl border border-baylink-border/60 bg-white/80 text-center text-xs text-baylink-muted">
              Screenshot pending
            </div>
            <p className="mt-2 text-sm font-medium text-baylink-text">{step}</p>
            <p className="mt-0.5 text-[11px] text-baylink-muted">Step {index + 1} of 5</p>
          </div>
        ))}
      </div>
    </LegalSection>
  </LegalPageLayout>
);
