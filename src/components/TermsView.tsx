import { LegalPageLayout, LegalP, LegalSection, LegalUl } from './LegalPageLayout';

export const TermsView = () => (
  <LegalPageLayout title="服务条款 · Terms of Service" updated="September 30, 2026">
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
        '服务预约不在 BAYLINK 收取服务款项。默认提交的是待服务提供者确认的申请；只有页面明确支持即时预约时，系统才可在时段有效且无冲突时直接确认。',
        '待确认申请暂时占用时段，在提交后 24 小时或预约开始时到期，以较早者为准。双方可取消；当前更换时间需要取消原预约后重新申请，不能把提出改期当作新时间已确认。',
        'BayBay AI 和生活指南可能存在遗漏或错误。重要事项请核对原始资料，不能替代法律、财务、医疗等专业意见。',
        '验证码由你主动请求；服务提供者预约短信另行同意，当前不向顾客发送预约短信。短信提交不保证送达，短信失败不影响已保存的预约与站内通知。',
      ]} />
    </LegalSection>

    <LegalSection title="Service Booking Requests / 服务预约申请">
      <LegalP>
        A provider must complete phone verification or BAYLINK profile review before enabling service bookings. These checks do not certify government approval, licensing, identity, service quality or safety. Providers are responsible for keeping their published availability, service area and service details accurate. BAYLINK does not collect service payments through this booking feature; the parties must separately agree on the scope, price and any payment arrangements.
      </LegalP>
      <LegalP>
        Bookings use request-and-confirm mode by default. Submitting a request does not mean the provider has accepted it. A pending request temporarily occupies its time slot and expires at the earlier of 24 hours after submission or the appointment start time. Cancellation, decline or expiry releases that reservation. A provider may explicitly offer instant booking; those bookings are confirmed only if the selected slot remains valid and available when submitted.
      </LegalP>
      <LegalP>
        Either participant may cancel a booking through the site. To arrange a different time, communicate with the other participant, cancel the original booking and submit a new request. BAYLINK does not currently transfer an existing booking to a new time as one action, and a proposed new time is not a confirmed appointment. A provider can mark a confirmed appointment completed after its end time; passing that time alone does not establish that the service was performed.
      </LegalP>
      <LegalP>
        服务提供者须完成手机号验证或 BAYLINK 资料审核后，才能开启预约。核验不代表政府认证、执照或服务保证。请双方确认服务范围、价格和付款方式；平台本功能不收取服务款项。默认申请须由提供者确认，待处理期间暂占时段，到期、拒绝或取消后释放。明确开启即时预约的服务，仍须通过提交时的时段与冲突检查。双方可取消；更换时间请先沟通，再取消原预约并重新申请。服务结束后由提供者标记完成，系统不把时间经过自动视为已履约。
      </LegalP>
    </LegalSection>

    <LegalSection title="Small-group outings / 一起出门">
      <LegalP>小队面向自行声明年满 18 岁的用户；发起与申请加入须完成当前手机号验证或平台资料审核。验证不等于身份、年龄或背景调查。每队 2–8 人，包含队长，首次见面请选择公共场所。小队申请只有被队长接受后才占用确认名额，不等于主办方报名、购票或服务预约。BAYLINK 本功能不收款，也不提供接送或人身安全保证。</LegalP>
      <LegalP>Members must self-declare that they are at least 18. Hosting and joining require current phone verification or BAYLINK profile review; neither verifies age or background. Groups have 2–8 people including the host and meet in public places. A request is pending until the host accepts it. Confirmation is a group coordination status, not an event ticket, organizer registration or service reservation. Members can leave, hosts can cancel, and material changes require members to reconfirm. AI prepares editable drafts only; users review and publish their own arrangements.</LegalP>
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
        Users should use caution when communicating, meeting, paying, renting, buying, selling, or hiring through BAYLINK. BAYLINK may provide safety tips, trust badges, phone verification, platform profile review, reporting tools, and moderation features, but these features do not guarantee that a user, post, or transaction is safe.
      </LegalP>
    </LegalSection>

    <LegalSection title="7. BayBay AI Features">
      <LegalP>
        BAYLINK may provide BayBay AI Guide, AI post-assist, AI suggestions, smart cards, safety tips, and other AI-powered features. AI-generated content may be incomplete, inaccurate, or not suitable for every situation. Users should independently verify important information and should not rely on AI output as legal, financial, medical, or professional advice.
      </LegalP>
      <LegalP>AI-generated descriptions, translations, estimates or suggested times do not accept a service request or bind either participant to a time, scope or price. Review any draft before using it. Appointment status must be checked in the booking record.</LegalP>
      <LegalP>AI 整理的需求、翻译、估算或建议时间不代表服务提供者接单，也不替双方承诺时间、服务范围或报价。使用草稿前请自行核对，预约是否确认以站内记录为准。</LegalP>
    </LegalSection>

    <LegalSection title="8. Phone Verification and Optional Booking SMS">
      <LegalP>
        BAYLINK may offer phone verification to improve account security and community trust. By entering your mobile phone number and clicking &ldquo;Send verification code,&rdquo; you agree to receive one-time SMS verification codes from BAYLINK for account security and community trust purposes.
      </LegalP>
      <LegalP>
        These messages are transactional and used only for account security and phone verification. BAYLINK does not send marketing or promotional SMS messages under this verification program.
      </LegalP>
      <LegalP>Message frequency varies based on your verification requests. Message and data rates may apply.</LegalP>
      <LegalP>Providers may separately enable booking SMS for new requests, instant bookings and cancellations by customers. This requires a verified phone number and an available, configured SMS service. Phone verification alone does not enroll anyone. We record the consent version and time, enabled preference and verified number covered by consent; changing that number requires fresh consent. Booking SMS is not sent to customers and does not include marketing or scheduled appointment reminders. Frequency depends on booking activity.</LegalP>
      <LegalP>You can disable booking SMS in booking notification settings. Follow the sender&apos;s STOP / HELP instructions for sender-level opt-out and help. The SMS provider manages that suppression; the BAYLINK setting does not override it. Opting out does not cancel bookings or disable in-site notifications.</LegalP>
      <LegalP>Booking changes are saved in booking records and related in-site messages. An accepted SMS submission does not guarantee delivery. A failed or unavailable text message does not cancel or remove a booking; use the site to check its current status.</LegalP>
      <LegalP>服务提供者在预约设置中另行选择业务短信，并可随时关闭；手机号验证本身不表示同意。当前短信只通知服务提供者新申请、即时预约与顾客取消，不向顾客发送预约短信。按发送方说明回复 STOP 可由短信服务处理退订；站内开关不会绕过退订状态。短信可能产生运营商费用，提交成功不保证送达，失败不影响站内预约记录。</LegalP>
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

    <LegalSection title="10. Account Trust and Platform Profile Review">
      <LegalP>
        BAYLINK may provide phone verification, platform profile review, profile badges, or other trust features. A platform review is not government certification. These features are intended to improve community trust but do not guarantee identity, quality, licensing, safety, legality, or transaction outcomes.
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
