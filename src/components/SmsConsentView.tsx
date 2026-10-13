import type { ReactNode } from 'react';
import { LegalPageLayout, LegalP, LegalSection, LegalUl, ZhLabel, ZhOnly } from './LegalPageLayout';
import { legalTitle, useLegalCopy } from './legal-copy';

/** The verification button's own bilingual label, quoted in the English text; its Chinese half is marked as Chinese. */
const SEND_CODE = <span>&ldquo;<ZhLabel>发送验证码</ZhLabel> / Send verification code&rdquo;</span>;

const OPT_IN_FLOW: { title: string; label?: ReactNode; image: string; description: string }[] = [
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
    title: 'Step 4: Click “Send verification code”',
    label: <span>Step 4: Click {SEND_CODE}</span>,
    image: '/sms-consent/step3-phone-verification-consent.png',
    description:
      'BAYLINK sends the one-time verification code only after the user actively clicks the button.',
  },
];

const SmsVerificationDisclosure = () => (
  <p>
    By clicking {SEND_CODE}, you agree to receive one-time SMS verification codes from BAYLINK at the mobile number provided for account security and phone verification. Message frequency varies based on your verification requests. Msg &amp; data rates may apply. Reply STOP to opt out or HELP for help. View our{' '}
    <a href="/privacy">
      Privacy Policy
    </a>
    {' '}and{' '}
    <a href="/terms">
      Terms of Service
    </a>
    .
  </p>
);

export const SmsConsentView = () => {
  const { english, t } = useLegalCopy();
  return (
  <LegalPageLayout title={{ zh: '短信同意说明', en: 'SMS Consent' }} updated="2026-09-30">
    <LegalP>
      BAYLINK offers two separate SMS uses: verification codes that you request, and optional booking updates for service providers. Verifying a phone number does not subscribe you to booking updates. Neither program sends marketing or promotional messages.
    </LegalP>

    <LegalSection title={'中文说明：何时会发送短信'}>
      <LegalUl items={[
        '一般使用 BAYLINK 不要求手机验证。登录后，你可以在个人资料中主动打开手机验证。',
        '输入手机号码、阅读按钮旁的说明，并点击「发送验证码」后，才会请求发送一次性验证码；普通账号注册不会自动请求验证短信。',
        '本验证项目用于账号安全和手机号验证，不发送营销短信。发送次数取决于你的验证请求，运营商可能收取短信或流量费。',
        t('服务提供者可另外在预约短信设置中主动开启业务通知。手机验证不等于同意预约短信；当前预约短信仅发给已同意的服务提供者，不发给顾客。', 'Service providers can separately turn on booking notifications in their booking SMS settings. Phone verification is not consent to booking texts; booking texts currently go only to providers who opted in, never to customers.'),
        t('预约短信只用于新申请、即时预约和顾客取消的相关通知，不是营销短信或定时到场提醒。预约状态与站内消息仍是查看处理结果的入口。', 'Booking texts cover only new requests, instant bookings and customer cancellations. They are not marketing or scheduled appointment reminders; the booking record and in-site messages show the current status.'),
        '短信退订与帮助方式见下方 STOP / HELP 说明；验证码收不到或有其他问题，可联系 Baylink.us@gmail.com。',
        '验证码请只填写在你主动打开的 BAYLINK 验证页面，不要发给其他用户。',
      ]} />
    </LegalSection>

    <LegalSection title="Phone verification messages">
      <LegalP>
        Verification codes are used only for account security and phone verification. BAYLINK does not send marketing or promotional SMS messages.
      </LegalP>
      <LegalP>
        A verification SMS is sent only after the user actively requests a code. Message frequency varies based on verification requests. Msg &amp; data rates may apply.
      </LegalP>
    </LegalSection>

    <LegalSection title="How users opt in to verification codes">
      <LegalP>Users opt in by completing the following steps inside BAYLINK:</LegalP>
      <LegalP>
        Phone verification is optional for general BAYLINK use and is only used when a user chooses to verify their phone number for account security and community trust. BAYLINK does not send SMS during account registration unless the user separately opens Phone Verification, enters a mobile number, and clicks {SEND_CODE}.
      </LegalP>
      <LegalUl
        items={[
          'Log in to BAYLINK.',
          'Open Profile and select Phone Verification.',
          'Enter their mobile phone number.',
          'Review the consent disclosure shown before sending a code.',
          <span>Click {SEND_CODE}.</span>,
          'Receive a one-time verification code by SMS.',
        ]}
      />
      <LegalP>
        No verification SMS is sent until the user enters a mobile number and clicks {SEND_CODE}. Verification consent is collected at that point inside the logged-in profile flow. The screenshots below show this verification flow, not consent to booking notifications.
      </LegalP>
    </LegalSection>

    <LegalSection title={legalTitle('Optional provider booking updates', '服务提供者预约短信', english)}>
      <LegalP>
        Service providers can separately enable booking SMS in their booking notification settings. This option requires a verified phone number and an available, configured SMS service. It is off unless the provider chooses to enable it. BAYLINK records the consent version, consent time, enabled preference and the verified number covered by that choice. Changing the verified number requires fresh consent. The number is not publicly displayed by verification or by enabling these notifications.
      </LegalP>
      <LegalP>
        These texts notify the provider about new booking requests, instant bookings and cancellations by customers. They are not customer SMS, marketing messages, or scheduled appointment reminders. Frequency depends on booking activity. Message and data rates may apply. Booking changes are also recorded through BAYLINK booking records and in-site messages; turning SMS off does not disable bookings or in-site notifications.
      </LegalP>
      <ZhOnly><LegalP>
        服务提供者需在预约通知设置中单独开启短信；开启前须验证手机号，且短信服务已配置可用。系统保存同意版本、时间、开关状态及该次同意对应的已验证号码；更换号码后须重新同意。手机号不会因此公开。短信仅通知服务提供者新申请、即时预约与顾客取消，不发送给顾客，也不提供定时提醒。关闭短信仍可使用预约和站内通知。
      </LegalP></ZhOnly>
      <LegalP>
        A status of &ldquo;SMS submitted&rdquo; means the delivery service accepted the request, not that the phone received it. Failed or unavailable SMS does not cancel or remove a booking. Check the booking record and in-site messages for the current status.
      </LegalP>
      <ZhOnly><LegalP>「短信已提交」只表示短信服务接受了发送请求，不保证已送达。短信失败或暂不可用不会取消或丢失预约，请在站内查看当前状态。</LegalP></ZhOnly>
    </LegalSection>

    <LegalSection title="Opt-out and help">
      <LegalP>You can turn off optional booking SMS in booking notification settings. For messages already received, follow the sender&apos;s STOP / HELP instructions. STOP suppression is handled by the SMS provider for that sender; it does not cancel a booking. Turning the BAYLINK setting on does not override a sender-level opt-out.</LegalP>
      <ZhOnly><LegalP>可在预约通知设置中关闭业务短信。对已收到的短信，可按发送方说明回复 STOP 退订或 HELP 求助；发送方的短信服务处理退订屏蔽。退订不会取消预约，重新打开站内开关也不会绕过发送方的退订状态。</LegalP></ZhOnly>
      <LegalP>
        For support, contact:{' '}
        <a href="mailto:Baylink.us@gmail.com">
          Baylink.us@gmail.com
        </a>
      </LegalP>
    </LegalSection>

    <LegalSection title="Privacy and terms">
      <LegalP>
        <a href="/privacy">
          Privacy Policy
        </a>
        {' · '}
        <a href="/terms">
          Terms of Service
        </a>
      </LegalP>
    </LegalSection>

    <LegalSection title="Phone Verification Opt-in Flow">
      <LegalP>
        The screenshots below illustrate the phone verification flow; the current interface may look different. A verification SMS is requested only after the user enters their mobile number, reviews the consent disclosure, and actively clicks {SEND_CODE}.
      </LegalP>
      <ol className="legal-steps">
        {OPT_IN_FLOW.map((step) => (
          <li key={step.title} className="legal-step">
            <h3>{step.label ?? step.title}</h3>
            <img src={step.image} alt={`${step.title} screenshot`} loading="lazy" />
            <p>{step.description}</p>
          </li>
        ))}
      </ol>
      <div className="legal-callout">
        <p>Disclosure shown next to the phone verification button</p>
        <SmsVerificationDisclosure />
      </div>
    </LegalSection>
  </LegalPageLayout>
);
};
