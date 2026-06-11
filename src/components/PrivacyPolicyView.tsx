import { LegalPageLayout, LegalP, LegalSection, LegalUl } from './LegalPageLayout';

export const PrivacyPolicyView = () => (
  <LegalPageLayout title="BAYLINK Privacy Policy" updated="May 2026">
    <LegalP>
      BAYLINK is a Bay Area local community and lifestyle information platform. This Privacy Policy explains how BAYLINK collects, uses, and protects information when users access baylink.us, create an account, publish posts, send messages, use BayBay AI features, or verify their phone number.
    </LegalP>

    <LegalSection title="1. Information We Collect">
      <LegalP>We may collect the following information:</LegalP>
      <LegalUl items={[
        'Account information such as email address, nickname, password hash, avatar, profile description, area, city, profile tags, interests, website, and social links.',
        'Contact and verification information such as phone number when a user chooses to complete phone verification.',
        'User-generated content such as posts, comments, messages, listings, service descriptions, images, and profile content.',
        'Technical information such as IP address, device information, browser type, log data, and usage activity.',
        'AI feature input when users choose to use BayBay AI Guide or AI post-assist features.',
      ]} />
    </LegalSection>

    <LegalSection title="2. How We Use Information">
      <LegalP>BAYLINK uses information to:</LegalP>
      <LegalUl items={[
        'Provide account login, registration, password reset, and user profile features.',
        'Allow users to publish local posts, listings, service offers, requests, and community content.',
        'Support messaging, safety features, reporting, moderation, and account trust.',
        'Send account-related emails such as password reset emails.',
        'Send one-time SMS verification codes when users request phone verification.',
        'Improve BAYLINK features, user experience, safety, and reliability.',
        'Prevent spam, abuse, fraud, fake accounts, and unsafe activity.',
      ]} />
    </LegalSection>

    <LegalSection title="3. Phone Number and SMS Verification">
      <LegalP>
        BAYLINK may collect your mobile phone number when you choose to complete phone verification for account security and community trust purposes. We use your phone number only to send one-time SMS verification codes and to help protect the BAYLINK community from spam, fraud, and abuse. Your phone number is not publicly displayed on your profile or posts.
      </LegalP>
      <LegalP>
        BAYLINK does not share, sell, rent, or disclose mobile phone numbers, SMS opt-in data, or SMS consent records with third parties or affiliates for marketing or promotional purposes.
      </LegalP>
      <LegalP>
        SMS messages are only sent after you actively enter your phone number and request a verification code. Message and data rates may apply. Message frequency varies based on your verification requests. You may reply STOP to opt out and HELP for help.
      </LegalP>
      <LegalP>
        当你选择完成手机验证时，BAYLINK 可能收集你的手机号码，仅用于账号安全、发送一次性验证码，以及帮助防范垃圾信息、欺诈和滥用行为。你的手机号不会在个人资料或帖子中公开显示。BAYLINK 不会出于营销或推广目的，向第三方或关联公司分享、出售、出租或披露手机号码、短信订阅同意数据或短信同意记录。
      </LegalP>
    </LegalSection>

    <LegalSection title="4. SMS Data Sharing">
      <LegalP>
        Mobile phone numbers, SMS opt-in data, and SMS consent are not shared with third parties or affiliates for marketing or promotional purposes.
      </LegalP>
      <LegalP>
        BAYLINK does not sell, rent, or share SMS opt-in data, SMS consent records, or mobile phone numbers with third parties or affiliates for marketing or promotional purposes. SMS opt-in information and phone numbers are used only to provide BAYLINK account verification, security, and related transactional service messages.
      </LegalP>
    </LegalSection>

    <LegalSection title="5. Emails">
      <LegalP>
        BAYLINK may send account-related emails, including password reset emails and important account notices. Users may contact BAYLINK if they have questions about account emails.
      </LegalP>
    </LegalSection>

    <LegalSection title="6. User Content">
      <LegalP>
        Users are responsible for the content they post on BAYLINK. Public posts, public profile information, and public listing details may be visible to other users or visitors. Users should not post sensitive personal information that they do not want to share publicly.
      </LegalP>
    </LegalSection>

    <LegalSection title="7. AI Features">
      <LegalP>
        BayBay AI features may process user-provided text to generate suggestions, post drafts, guide responses, safety tips, or related content. Users should avoid submitting highly sensitive personal information to AI features.
      </LegalP>
    </LegalSection>

    <LegalSection title="8. Information Sharing">
      <LegalP>BAYLINK may share limited information:</LegalP>
      <LegalUl items={[
        'With service providers that help operate BAYLINK, such as hosting, database, image storage, email delivery, SMS delivery, analytics, or infrastructure providers.',
        'When required by law, legal process, or government request.',
        'To protect BAYLINK, users, property, safety, and legal rights.',
        'In connection with a business transfer, merger, acquisition, or reorganization.',
      ]} />
      <LegalP>BAYLINK does not sell personal information.</LegalP>
      <LegalP>
        This excludes mobile phone numbers, SMS opt-in data, and SMS consent, which will not be shared with third parties or affiliates for marketing or promotional purposes.
      </LegalP>
    </LegalSection>

    <LegalSection title="9. Data Security">
      <LegalP>
        BAYLINK uses reasonable technical and organizational measures to protect user information, including password hashing, token-based authentication, limited public profile fields, and restricted access to sensitive information. However, no online service can guarantee complete security.
      </LegalP>
    </LegalSection>

    <LegalSection title="10. Data Retention">
      <LegalP>
        BAYLINK retains information for as long as needed to provide services, maintain account records, comply with legal obligations, resolve disputes, prevent abuse, and improve safety. Users may contact BAYLINK to request account-related assistance.
      </LegalP>
    </LegalSection>

    <LegalSection title="11. Children">
      <LegalP>BAYLINK is not intended for children under 13. Users should not use BAYLINK if they are under 13 years old.</LegalP>
    </LegalSection>

    <LegalSection title="12. California Users">
      <LegalP>
        California users may have rights under applicable privacy laws, including rights to request access, deletion, or correction of certain personal information, subject to legal limitations.
      </LegalP>
    </LegalSection>

    <LegalSection title="13. Changes to This Policy">
      <LegalP>
        BAYLINK may update this Privacy Policy from time to time. Updated versions will be posted on this page with a new &ldquo;Last updated&rdquo; date.
      </LegalP>
    </LegalSection>

    <LegalSection title="14. Contact">
      <LegalP>
        For privacy questions, contact:{' '}
        <a href="mailto:Baylink.us@gmail.com" className="font-medium text-baylink-green hover:underline">Baylink.us@gmail.com</a>
      </LegalP>
    </LegalSection>
  </LegalPageLayout>
);
