import { LegalPageLayout, LegalP, LegalSection, LegalUl } from './LegalPageLayout';

export const PrivacyPolicyView = () => (
  <LegalPageLayout title="BAYLINK Privacy Policy" updated="June 2026">
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
        When users choose to verify their phone number, BAYLINK collects the phone number only for account security, phone verification, abuse prevention, and community trust. Phone numbers are not publicly displayed on user profiles or posts.
      </LegalP>
      <LegalP>
        BAYLINK may send one-time SMS verification codes to users who actively enter their phone number and click the button to request a verification code. BAYLINK does not use phone numbers collected for SMS verification for marketing or promotional text messages.
      </LegalP>
    </LegalSection>

    <LegalSection title="4. SMS Data Sharing">
      <LegalP>
        BAYLINK does not sell, rent, or share SMS opt-in data or phone numbers with third parties for their marketing purposes. SMS opt-in information and phone numbers are used only to provide BAYLINK account verification, security, and related service messages.
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
