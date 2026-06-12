import { LegalPageLayout, LegalP, LegalSection, LegalUl } from './LegalPageLayout';

const OPT_IN_FLOW = [
  {
    title: 'Step 1: Log in to BAYLINK',
    description: 'The user logs into their BAYLINK account from baylink.us.',
  },
  {
    title: 'Step 2: Open Profile → Phone Verification',
    description: 'Inside the profile page, the user opens the phone verification section.',
  },
  {
    title: 'Step 3: Enter mobile number',
    description: 'The user enters their own mobile phone number in the phone verification form.',
  },
  {
    title: 'Step 4: Review consent disclosure',
    description:
      'Before sending a code, BAYLINK displays that SMS is used only for one-time verification codes, message frequency varies, Msg & data rates may apply, and users can reply STOP to opt out or HELP for help.',
  },
  {
    title: 'Step 5: Click “Send verification code”',
    description:
      'BAYLINK sends the one-time verification code only after the user actively clicks the button.',
  },
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
          'Review the consent disclosure shown before sending a code.',
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

    <LegalSection title="Phone Verification Opt-in Flow">
      <LegalP>
        The flow below shows how a BAYLINK user opts in to receive one-time SMS verification codes for phone verification. SMS is sent only after the user enters their mobile number and actively clicks &ldquo;Send verification code&rdquo;.
      </LegalP>
      <div className="mt-4 space-y-3">
        {OPT_IN_FLOW.map((step, index) => (
          <div
            key={step.title}
            className="flex gap-3 rounded-2xl border border-baylink-border/60 bg-white/90 p-4 shadow-rest"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-baylink-green-light text-sm font-bold text-baylink-green">
              {index + 1}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-baylink-text">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-baylink-text-secondary">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-2xl border border-baylink-green/20 bg-baylink-green/5 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-baylink-green">
          Disclosure shown next to the phone verification CTA
        </p>
        <p className="text-sm leading-relaxed text-baylink-text-secondary">
          By clicking &ldquo;Send verification code&rdquo;, you agree to receive one-time SMS verification codes from BAYLINK at the mobile number provided for account security and phone verification. Message frequency varies based on your verification requests. Msg &amp; data rates may apply. Reply STOP to opt out or HELP for help. View our{' '}
          <a href="/privacy" className="font-medium text-baylink-green hover:underline">
            Privacy Policy
          </a>
          {' '}and{' '}
          <a href="/terms" className="font-medium text-baylink-green hover:underline">
            Terms of Service
          </a>
          .
        </p>
      </div>
    </LegalSection>
  </LegalPageLayout>
);
