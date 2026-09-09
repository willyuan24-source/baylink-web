import { LegalPageLayout, LegalP, LegalSection, LegalUl } from './LegalPageLayout';

export const TermsView = () => (
  <LegalPageLayout title="服务条款 · Terms of Service" updated="September 8, 2026">
    <LegalP>
      Welcome to BAYLINK. BAYLINK is a Bay Area local community and lifestyle information platform for local posts, housing, roommate search, secondhand exchange, local services, rides, moving, cleaning, repairs, community help, local guides, and BayBay AI features.
    </LegalP>
    <LegalP>By accessing or using BAYLINK, you agree to these Terms of Service.</LegalP>

    <LegalSection title="中文阅读要点">
      <LegalP>以下是便于阅读的中文说明，对应下方英文条款。涉及具体权利、责任和适用条件，请结合完整条款阅读；有疑问可通过页末邮箱联系 BAYLINK。</LegalP>
      <LegalUl items={[
        'BAYLINK 提供本地信息发布与沟通工具。用户之间的租房、买卖、接送和服务交易由交易双方自行确认和履行。',
        '请发布真实、合法的信息，不得诈骗、骚扰、冒充他人、歧视或侵犯他人权益。请妥善保管账号。',
        '「手机号已验证」表示完成过短信验证码验证；「资料审核通过」表示资料经过 BAYLINK 人工审核。两者都不构成政府认证、身份或执照保证，也不保证交易安全。',
        '编辑推荐表示平台选择展示的内容。请仍然自行核实房源、商品、服务资质、价格和付款安排。',
        'BayBay AI 和生活指南可能存在遗漏或错误。重要事项请核对原始资料，不能替代法律、财务、医疗等专业意见。',
        '手机号验证短信由你主动请求，用于账号验证与安全。短信的费用、退订和帮助说明见下方 SMS 条款。',
      ]} />
    </LegalSection>

    <LegalSection title="1. Use of BAYLINK">
      <LegalP>
        Users may use BAYLINK to browse, publish, and interact with local community information. Users are responsible for the accuracy, legality, and safety of the content they post.
      </LegalP>
    </LegalSection>

    <LegalSection title="2. Accounts">
      <LegalP>
        Users may need an account to post content, send messages, save information, verify a phone number, or use certain features. Users are responsible for maintaining the security of their account credentials.
      </LegalP>
    </LegalSection>

    <LegalSection title="3. User Content">
      <LegalP>
        Users are solely responsible for posts, listings, images, messages, comments, service descriptions, profile content, and other content they submit. BAYLINK may remove or restrict content that appears unsafe, misleading, fraudulent, illegal, spammy, abusive, discriminatory, or otherwise inappropriate.
      </LegalP>
    </LegalSection>

    <LegalSection title="4. Prohibited Conduct">
      <LegalP>Users may not:</LegalP>
      <LegalUl items={[
        'Post fraudulent, misleading, illegal, unsafe, abusive, or discriminatory content.',
        'Impersonate another person, business, official organization, or BAYLINK representative.',
        'Use BAYLINK for scams, phishing, spam, harassment, or unauthorized advertising.',
        'Upload malicious code or attempt to disrupt BAYLINK systems.',
        'Collect other users\u2019 information without permission.',
        'Use BAYLINK to violate laws, housing rules, employment rules, consumer protection rules, or platform policies.',
      ]} />
    </LegalSection>

    <LegalSection title="5. Local Listings, Housing, Services, and Transactions">
      <LegalP>
        BAYLINK provides an information platform. BAYLINK is not a party to transactions between users, landlords, tenants, service providers, buyers, sellers, drivers, or other parties. Users are responsible for verifying information, meeting safely, following applicable laws, and making their own decisions.
      </LegalP>
      <LegalP>
        BAYLINK does not guarantee the quality, legality, accuracy, availability, safety, or outcome of any post, listing, service, rental, transaction, or user interaction.
      </LegalP>
    </LegalSection>

    <LegalSection title="6. Safety">
      <LegalP>
        Users should use caution when communicating, meeting, paying, renting, buying, selling, or hiring through BAYLINK. BAYLINK may provide safety tips, trust badges, phone verification, official verification, reporting tools, and moderation features, but these features do not guarantee that a user, post, or transaction is safe.
      </LegalP>
    </LegalSection>

    <LegalSection title="7. BayBay AI Features">
      <LegalP>
        BAYLINK may provide BayBay AI Guide, AI post-assist, AI suggestions, smart cards, safety tips, and other AI-powered features. AI-generated content may be incomplete, inaccurate, or not suitable for every situation. Users should independently verify important information and should not rely on AI output as legal, financial, medical, or professional advice.
      </LegalP>
    </LegalSection>

    <LegalSection title="8. Phone Verification and SMS Terms">
      <LegalP>
        BAYLINK may offer phone verification to improve account security and community trust. By entering your mobile phone number and clicking &ldquo;Send verification code,&rdquo; you agree to receive one-time SMS verification codes from BAYLINK for account security and community trust purposes.
      </LegalP>
      <LegalP>
        These messages are transactional and used only for account security and phone verification. BAYLINK does not send marketing or promotional SMS messages under this verification program.
      </LegalP>
      <LegalP>Message frequency varies based on your verification requests. Message and data rates may apply.</LegalP>
      <LegalP>You can reply STOP to opt out of SMS messages and HELP for help.</LegalP>
      <LegalP>
        BAYLINK does not share SMS opt-in data or consent with third parties or affiliates for marketing or promotional purposes.
      </LegalP>
      <LegalP>Carriers are not liable for delayed or undelivered messages.</LegalP>
      <LegalP>
        For support, contact:{' '}
        <a href="mailto:Baylink.us@gmail.com" className="font-medium text-baylink-green hover:underline">Baylink.us@gmail.com</a>
      </LegalP>
    </LegalSection>

    <LegalSection title="9. Privacy">
      <LegalP>
        BAYLINK&apos;s Privacy Policy explains how information is collected, used, and protected:{' '}
        <a href="https://www.baylink.us/privacy" className="font-medium text-baylink-green hover:underline">https://www.baylink.us/privacy</a>
      </LegalP>
    </LegalSection>

    <LegalSection title="10. Account Trust and Official Verification">
      <LegalP>
        BAYLINK may provide phone verification, official verification, profile badges, or other trust features. These features are intended to improve community trust but do not guarantee identity, quality, licensing, safety, legality, or transaction outcomes.
      </LegalP>
    </LegalSection>

    <LegalSection title="11. Suspension and Removal">
      <LegalP>
        BAYLINK may remove content, restrict features, suspend accounts, or take other action if BAYLINK believes a user or content may violate these Terms, harm the community, create risk, or violate applicable law.
      </LegalP>
    </LegalSection>

    <LegalSection title="12. No Warranty">
      <LegalP>
        BAYLINK is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; BAYLINK does not guarantee uninterrupted service, error-free operation, accuracy of content, successful transactions, or availability of any feature.
      </LegalP>
    </LegalSection>

    <LegalSection title="13. Limitation of Liability">
      <LegalP>
        To the maximum extent permitted by law, BAYLINK is not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for disputes, losses, harm, or damages arising from user interactions, listings, services, posts, transactions, or reliance on platform content.
      </LegalP>
    </LegalSection>

    <LegalSection title="14. Changes to These Terms">
      <LegalP>
        BAYLINK may update these Terms from time to time. Updated versions will be posted on this page with a new &ldquo;Last updated&rdquo; date.
      </LegalP>
    </LegalSection>

    <LegalSection title="15. Contact">
      <LegalP>
        For questions about these Terms, contact:{' '}
        <a href="mailto:Baylink.us@gmail.com" className="font-medium text-baylink-green hover:underline">Baylink.us@gmail.com</a>
      </LegalP>
    </LegalSection>
  </LegalPageLayout>
);
