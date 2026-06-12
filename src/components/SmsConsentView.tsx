import { LegalPageLayout, LegalP, LegalSection, LegalUl } from './LegalPageLayout';

const OPT_IN_FLOW = [
  {
    title: 'Step 1: Log in to BAYLINK',
    image: '/sms-consent/step1-login.png',
    description: 'The user logs into their BAYLINK account from baylink.us.',
  },
  {
    title: 'Step 2: Open Profile → Phone Verification',
    image: '/sms-consent/step2-profile-phone-verification.png',
    description: 'Inside the profile page, the user opens the phone verification section.',
  },
  {
    title: 'Step 3: Enter mobile number and review consent disclosure',
    image: '/sms-consent/step3-phone-verification-consent.png',
    description:
      'The user enters their mobile number and sees the SMS consent disclosure before requesting a code.',
  },
  {
    title: 'Step 4: Click “发送验证码 / Send verification code”',
    image: '/sms-consent/step3-phone-verification-consent.png',
    description:
      'BAYLINK sends the one-time verification code only after the user actively clicks the button.',
  },
];

const SmsVerificationDisclosure = () => (
  <p className="text-sm leading-relaxed text-baylink-text-secondary">
    By clicking &ldquo;发送验证码 / Send verification code&rdquo;, you agree to receive one-time SMS verification codes from BAYLINK at the mobile number provided for account security and phone verification. Message frequency varies based on your verification requests. Msg &amp; data rates may apply. Reply STOP to opt out or HELP for help. View our{' '}
    <a href="/privacy" className="font-medium text-baylink-green hover:underline">
      Privacy Policy
    </a>
    {' '}and{' '}
    <a href="/terms" className="font-medium text-baylink-green hover:underline">
      Terms of Service
    </a>
    .
  </p>
);

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
      <LegalP>
        Phone verification is optional for general BAYLINK use and is only used when a user chooses to verify their phone number for account security and community trust. BAYLINK does not send SMS during account registration unless the user separately opens Phone Verification, enters a mobile number, and clicks &ldquo;发送验证码 / Send verification code&rdquo;.
      </LegalP>
      <LegalUl
        items={[
          'Log in to BAYLINK.',
          'Open Profile and select Phone Verification.',
          'Enter their mobile phone number.',
          'Review the consent disclosure shown before sending a code.',
          'Click “发送验证码 / Send verification code”.',
          'Receive a one-time verification code by SMS.',
        ]}
      />
      <LegalP>
        No SMS is sent until the user enters a mobile number and clicks &ldquo;发送验证码 / Send verification code&rdquo;. Consent is not collected on a separate public form; it is collected at the point of verification inside the logged-in profile flow.
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
        The flow below shows how a BAYLINK user opts in to receive one-time SMS verification codes for phone verification. SMS is sent only after the user enters their mobile number, reviews the consent disclosure, and actively clicks &ldquo;发送验证码 / Send verification code&rdquo;.
      </LegalP>
      <div className="mt-4 space-y-5">
        {OPT_IN_FLOW.map((step) => (
          <div
            key={step.title}
            className="overflow-hidden rounded-2xl border border-baylink-border/60 bg-white/90 shadow-rest"
          >
            <div className="border-b border-baylink-border/40 px-4 py-3">
              <h3 className="text-sm font-semibold text-baylink-text">{step.title}</h3>
            </div>
            <div className="bg-baylink-bg-alt/50 p-3">
              <img
                src={step.image}
                alt={`${step.title} screenshot`}
                loading="lazy"
                className="mx-auto w-full max-w-full rounded-xl border border-black/[0.04] bg-white object-contain"
              />
            </div>
            <p className="px-4 py-3 text-sm leading-relaxed text-baylink-text-secondary">{step.description}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-2xl border border-baylink-green/20 bg-baylink-green/5 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-baylink-green">
          Disclosure shown next to the phone verification CTA
        </p>
        <SmsVerificationDisclosure />
      </div>
    </LegalSection>
  </LegalPageLayout>
);
