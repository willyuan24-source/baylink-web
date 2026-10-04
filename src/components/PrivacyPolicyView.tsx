import { LegalPageLayout, LegalP, LegalSection, LegalUl } from './LegalPageLayout';

export const PrivacyPolicyView = () => (
  <LegalPageLayout title="隐私政策 · Privacy Policy" updated="September 30, 2026">
    <LegalP>
      BAYLINK is a Bay Area local community and lifestyle information platform. This Privacy Policy explains how BAYLINK collects, uses, and protects information when users access baylink.us, create an account, publish posts, send messages, use service bookings or BayBay AI features, or verify their phone number.
    </LegalP>

    <LegalSection title="中文阅读要点">
      <LegalP>以下说明帮助你理解不同信息的用途与可见范围；详细内容见下方完整政策。</LegalP>
      <LegalUl items={[
        '账号资料、公开帖子和公开个人资料可能被其他用户或访客看到。请勿在公开正文中填写不希望公开的电话号码、住址或证件信息。',
        '用于短信验证的手机号与「联系方式设置」中主动填写的电话、微信、邮箱是不同用途的信息。验证手机号不会因为完成验证而自动展示在帖子或资料中。',
        '预约双方可以查看该预约的时间、状态和顾客填写的备注。请不要在备注中填写密码、证件号码或无需提供的信息。提供者发布的可申请时段与服务设置会用于预约展示。',
        '手机验证与预约短信同意分开。服务提供者可单独开启预约业务短信；当前不向顾客发送预约短信。短信开关不影响站内预约记录与通知。',
        '你可选择优先私信、对方请求后自动发送联系方式，或经你确认后发送。接收人可以保存已收到的联系方式，请在发送前确认内容与对象。',
        '使用 BayBay AI 时，你输入的文字可能被处理以生成建议和草稿。不要输入证件号码、账号密码或其他高度敏感信息。',
        '如需了解、访问、更正或请求删除与账号有关的信息，可向页末邮箱提出申请。具体适用范围和必要核验将根据申请及适用规则确认；此页面不承诺自动删除或固定处理时限。',
      ]} />
    </LegalSection>

    <LegalSection title="Small-group visibility / 小队信息可见范围">
      <LegalP>发布后，小队标题、介绍、日期时段、城市、公共集合点、费用说明、人数和队长公开昵称可被其他人看到。请勿填写家庭住址、电话或证件信息。申请备注提供给队长；确认成员可以查看成员名单和队内讨论。退出或被移除后，不能继续访问讨论。举报会将相关内容提供给管理员处理；退出小队不会撤回别人已经看到的信息，也不会自动删除举报记录。</LegalP>
      <LegalP>Published outing details and the host’s public nickname are visible to other users and visitors. Request notes are shown to the host, while confirmed members can access the group roster and discussion. Leaving or removal ends discussion access. We store membership status, consent timestamps, changes, messages and report evidence to operate groups and handle abuse. Reports are available to administrators. Using the optional AI draft tool sends the idea you submit and any linked public event context to the AI provider; private profiles or group conversations are not included by this tool. Outing notifications use the site, not SMS.</LegalP>
    </LegalSection>

    <LegalSection title="1. Information We Collect">
      <LegalP>We may collect the following information:</LegalP>
      <LegalUl items={[
        'Account information such as email address, nickname, password hash, avatar, profile description, area, city, profile tags, interests, website, and social links.',
        'Contact and verification information such as phone number when a user chooses to complete phone verification.',
        'Contact details such as WeChat ID, phone number, email address, and contact-sharing preferences that a user chooses to provide for contact requests.',
        'User-generated content such as posts, comments, messages, listings, service descriptions, images, and profile content.',
        'Event IDs, interest and public buddy-list choices, and timestamps when signed-in users choose Interested or Go together.',
        'Provider booking settings and availability; booking participant references, selected times, status, customer notes, status changes and related in-site messages.',
        'Optional provider booking-SMS preferences, consent version and time, the verified phone number covered by consent, and notification submission or failure records.',
        'Technical information such as IP address, device information, browser type, log data, and usage activity.',
        'AI feature input when users choose to use BayBay AI Guide or AI post-assist features.',
      ]} />
    </LegalSection>

    <LegalSection title="Anonymous product counters / 匿名功能统计">
      <LegalP>We count successful recommendation requests, plan saves, share-link actions, favorites, map opens and official-link clicks by day and interface language. These first-party counters contain no account or session identifier, IP address, content ID, page URL, chat text or precise location. They do not measure unique visitors or individual return visits. We do not send authentication or referrer data with these requests, and we skip them when your browser enables Do Not Track or Global Privacy Control. Aggregate records expire after 180 days. Normal hosting and security logs are separate.</LegalP>
      <LegalP>功能统计只按日期和界面语言累计推荐、保存、分享、收藏、地图与官方链接操作次数，不识别个人或跨次访问。统计请求不携带账号、问题正文或页面地址；浏览器开启 Do Not Track 或 Global Privacy Control 时不发送。聚合记录保留 180 天。</LegalP>
    </LegalSection>

    <LegalSection title="2. How We Use Information">
      <LegalP>BAYLINK uses information to:</LegalP>
      <LegalUl items={[
        'Provide account login, registration, password reset, and user profile features.',
        'Allow users to publish local posts, listings, service offers, requests, and community content.',
        'Support messaging, safety features, reporting, moderation, and account trust.',
        'Send account-related emails such as password reset emails.',
        'Send one-time SMS verification codes when users request phone verification.',
        'Publish provider availability, process booking requests and confirmations, prevent overlapping bookings, and notify participants of booking changes through the site.',
        'Send optional transactional booking SMS to service providers who separately enable them and meet the phone-verification and SMS-service requirements.',
        'Improve BAYLINK features, user experience, safety, and reliability.',
        'Prevent spam, abuse, fraud, fake accounts, and unsafe activity.',
      ]} />
    </LegalSection>

    <LegalSection title="3. Phone Numbers and SMS Consent">
      <LegalP>
        BAYLINK may collect your mobile phone number when you choose to complete phone verification for account security and community trust purposes. We use it to send requested verification codes and help protect the community from spam, fraud, and abuse. If you are a service provider and separately enable booking SMS, we also use your verified number for those transactional notices. Verification or booking-SMS consent does not publicly display that number. Contact details you separately provide for contact requests follow the sharing preferences you select.
      </LegalP>
      <LegalP>
        BAYLINK does not share, sell, rent, or disclose mobile phone numbers, SMS opt-in data, or SMS consent records with third parties or affiliates for marketing or promotional purposes.
      </LegalP>
      <LegalP>
        Verification messages follow your requests for a code. Provider booking SMS requires separate consent and an available, configured SMS service; it covers new booking requests, instant bookings and cancellations by customers. It does not send booking SMS to customers, marketing messages, or scheduled appointment reminders. Frequency varies with verification requests or booking activity, and message and data rates may apply.
      </LegalP>
      <LegalP>
        For optional provider booking SMS, we record the consent version and time, enabled preference, and verified number covered by the choice. A changed verified number requires fresh consent. You can turn booking SMS off in booking notification settings. Follow the sending service&apos;s STOP / HELP instructions to manage sender-level opt-out; this does not cancel bookings, and enabling the site setting does not override that opt-out. SMS submission is not proof of delivery. Failed SMS does not remove a booking or its in-site record.
      </LegalP>
      <LegalP>
        验证手机号用于你主动请求的验证码与账号安全；服务提供者单独开启预约短信后，也用于相应业务通知。系统保存短信同意版本、时间、开关状态与同意对应的已验证号码；更换号码须重新同意。验证或开启通知不会公开号码，另行填写的联系信息仍按你的分享设置处理。可在预约通知设置中关闭业务短信，也可按短信发送方说明退订。短信发送请求被接受不等于送达，失败不影响已保存的预约和站内消息。BAYLINK 不会出于营销或推广目的分享、出售、出租或披露手机号码及短信同意数据。
      </LegalP>
    </LegalSection>

    <LegalSection title="Service Bookings / 服务预约信息">
      <LegalP>
        Provider availability and published booking settings help customers choose a time to request. A booking&apos;s provider and customer can access its selected time, status and customer notes. These appointment details are not a public booking list. BAYLINK processes the records to manage requests, confirmations, cancellations, declines, completion and expiry, and to save related in-site notifications. SMS delivery providers receive the recipient number and message content when an eligible provider has opted in. BAYLINK does not collect service payments through this booking feature.
      </LegalP>
      <LegalP>
        提供者发布的时段和预约设置用于让顾客选择申请时间。预约时间、状态及顾客备注可由该预约双方查看，不作为公开预约名单展示。系统处理申请、确认、取消、拒绝、完成与到期状态，并保存相应站内通知；服务提供者选择接收短信后，短信服务商会处理接收号码和消息内容。本预约功能不收取服务款项。
      </LegalP>
      <LegalP>
        Canceling a booking, allowing a request to expire, or disabling future availability changes its status or future availability; it does not automatically erase historical booking records or messages. Account-related access, correction or deletion requests can be sent to the contact below. Share only information needed to arrange the service, and avoid credentials, identity-document numbers or unnecessary sensitive details in booking notes.
      </LegalP>
      <LegalP>取消、申请到期或关闭未来可预约时段不等于删除历史预约和消息。可通过页末联系方式提出访问、更正或删除申请。备注请只填写安排服务所需的信息，避免密码、证件号码和不必要的敏感内容。</LegalP>
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
      <LegalP>Event interest is stored with your account and contributes to public aggregate counts. Selecting Interested alone does not publish your identity. If you explicitly join Go together, your nickname, avatar and city are displayed in that event's public buddy list, and members may contact you through site messaging. You may leave the list or cancel your interest at any time. Cancellation updates the stored choice; it does not automatically delete historical database records. Account data deletion requests can be made through the contact below.</LegalP>
      <LegalP>活动“想去”会与账号关联并计入公开总人数，单独点“想去”不会公开你的身份。主动加入“一起去”后，昵称、头像和城市才会显示在该活动的公开搭子列表，其他用户可通过站内私信联系你。你可随时退出或取消想去。取消会更新已保存的状态，不会自动删除历史数据库记录；如需删除账号相关数据，可通过页末邮箱申请。</LegalP>
      <LegalP>
        Users are responsible for the content they post on BAYLINK. Public posts, public profile information, and public listing details may be visible to other users or visitors. Users should not post sensitive personal information that they do not want to share publicly.
      </LegalP>
      <LegalP>
        If you choose to provide contact details for contact requests, those details may be sent to a requesting user automatically or after your confirmation, depending on your selected sharing mode. Recipients may retain information they have already received. Prefer in-platform messaging when you do not want to share contact details.
      </LegalP>
    </LegalSection>

    <LegalSection title="7. AI Features">
      <LegalP>Quick search searches the published editorial catalog in your browser and may send search keywords to BAYLINK to retrieve public community posts. Opening BayBay and submitting a question may send that question, the current page path, recognized city/date filters, city/date requirements you stated earlier in this chat and up to four recent question-and-answer pairs to our AI service provider. When available, Smart search may use web search for current or additional information; Web search explicitly requests it. Search terms may then be processed by the provider's web-search service. Site only disables external web retrieval, but may still use the AI service to explain site material. Each reply identifies its retrieval scope and any available sources.</LegalP>
      <LegalP>快速搜索在浏览器中查找已发布的内容目录，也可能将搜索关键词发送给 BAYLINK 查询公开邻里帖子。向 BayBay 提问时，问题、当前页面路径、已识别的城市与日期筛选、你在本次对话中说明的城市与日期条件，以及最近最多四轮问答可能发送给 AI 服务提供商。服务可用时，「智能检索」会按需要联网补充信息，「联网查」会主动请求联网；搜索词可能由提供商的联网检索服务处理。「仅站内」关闭站外检索，但仍可能使用 AI 整理站内资料。每条回复会说明实际检索范围并提供可用来源。</LegalP>
      <LegalP>
        BayBay AI features may process user-provided text to generate suggestions, post drafts, guide responses, safety tips, or related content. Users should avoid submitting highly sensitive personal information to AI features.
      </LegalP>
      <LegalP>When you request a BayBay outing suggestion, your submitted text and filters may be sent to our AI service provider to interpret your request. Saved plan titles and account libraries are not included in that request. Suggested places and dates are checked against our published catalog.</LegalP>
      <LegalP>When you choose to read an event screenshot, the selected image is sent to our AI service provider. BAYLINK saves the event text only after you review and confirm it; the source image is not added to your saved event. Imported events stay in this browser for guests or privately in the signed-in account. You can edit or remove them in My Week.</LegalP>
      <LegalP>Message translation sends only the selected text message to our AI service provider. Reply assistance uses your stated intent and, if selected, one message for context. It does not send the whole conversation. AI replies remain drafts until you choose to send them.</LegalP>
      <LegalP>识别活动截图时，所选图片会发送给 AI 服务提供商；你核对并确认后，BAYLINK 只保存活动文字，不把原图加入活动记录。访客活动保存在此浏览器，登录后的活动私密保存在账号中，可在「我的这周」修改或移除。私信翻译只处理所选文字消息，回复助手只处理你填写的意思和选中的一条消息，不发送整段聊天记录；回复由你决定是否发送。</LegalP>
    </LegalSection>

    <LegalSection title="Outing Plans, Favorites and Maps">
      <LegalP>Guest plans and favorites stay in browser storage. When signed in, plans, favorites and selected regions, interests and travel preferences are stored with your account for access on other devices. Importing guest content is optional and requires a separate action. These account records are private. Public plan links contain selected public place or event IDs and a date, without your account ID or private plan title. Anyone receiving a link can view or forward those public selections.</LegalP>
      <LegalP>访客计划和收藏留在本机浏览器。登录后保存的计划、收藏、地区、兴趣和出行偏好会与账号关联，供其他设备读取；导入访客内容需要你主动选择。账号计划不公开，分享链接只包含公开地点编号和日期，不含账号编号或私人计划名称。拿到链接的人可以查看和转发这些公开选择。</LegalP>
      <LegalP>Opening the interactive map loads tiles from OpenFreeMap, which receives the network request and the map areas requested. This feature does not request your device location. You can remove saved plans and favorites in My Week; account-related privacy requests can be sent to the contact below.</LegalP>
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
