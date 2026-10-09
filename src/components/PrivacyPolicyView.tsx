import { LegalPageLayout, LegalP, LegalSection, LegalUl } from './LegalPageLayout';
import { useLocale, translateText } from '../i18n/locale';

export const PrivacyPolicyView = () => {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  return (
  <LegalPageLayout title="隐私政策 · Privacy Policy" updated="October 8, 2026">
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
        t('站内反馈只发送你在反馈表里选择和填写的内容，以及页面类型、语言、字号和网站版本，保存 90 天；不附带网址、账号或 BayBay 对话。内测模式须你点同意后才开启。', 'Site feedback sends only what you choose and type in the form, plus the page type, language, text size and site version, and is kept for 90 days. It never includes the address, your account or a BayBay conversation. Tester mode starts only after you agree.'),
        t('登录后，可在「我的 → 隐私与安全」下载本人资料、退出所有登录或确认永久注销。每次敏感操作都须确认当前凭证。资料较多、账号无法登录或需人工核验时，可向页末邮箱提出隐私申请；不承诺固定处理时限或外部缓存即时清除。', 'After signing in, open My profile → Privacy and security to download your data, sign out all sessions, or confirm permanent account deletion. Each sensitive operation requires current credentials. For larger exports, inaccessible accounts or requests requiring manual verification, contact the email below. We do not promise a fixed processing deadline or immediate erasure of external caches.'),
      ]} />
    </LegalSection>

    <div translate="no">
      <LegalSection title={t('账号导出、注销与两步验证', 'Account export, deletion and two-step verification')}>
        <LegalP>{t('账号资料导出使用明确的本人字段和记录范围，包括本人资料、发布、自己发送的文字消息与私密计划；不批量提供别人发来的私信、别人分享的联系方式、安全密钥、密码哈希或登录令牌。导出文件含私人信息，请自行安全保管。', 'Account export uses explicit ownership and field limits: your profile, posts, authored text messages and private plans. It excludes received private messages, other people’s shared contact details, security secrets, password hashes and login tokens. The downloaded file contains private information; store it safely.')}</LegalP>
        <LegalP>{t('永久注销要求当前密码、已启用时的验证器代码或恢复码，以及明确输入注销确认语句。成功后，在线账号资料、本人联系方式、本人消息、私密计划、联系方式快照与令牌关联会删除或去标识；本人发布会移除，主持的小队会取消。共享记录中的其他人的内容按其记录用途保留。管理员必须先安全移交权限。注销不可恢复；仍在处理的相关写入或清理失败时，会拒绝确认成功。', 'Permanent deletion requires your current password, an authenticator or recovery code when enabled, and an explicit confirmation phrase. After success, online account data, your contacts, authored messages, private plans, stored contact snapshots and token associations are removed or anonymized; your posts are removed and hosted groups are cancelled. Other people’s content in shared records remains subject to its purpose. Administrators must safely hand over their role first. Deletion is irreversible; pending related writes or failed cleanup prevent a success confirmation.')}</LegalP>
        <LegalP>{t('可选管理员验证器仅在服务器配置独立加密密钥后提供。密钥加密存储，恢复码只保存哈希；必须保存恢复码并验证首枚代码后才启用。登录需要密码及额外代码，停用和更换恢复码需要重新确认凭证。尚未启用的账号不会因缺少该配置被锁住。', 'Optional administrator authenticator setup is available only after a separate server encryption key is configured. Secrets are encrypted and recovery codes are stored as hashes. Activation requires saved recovery codes and confirmation of a first code. Sign-in requires a password and additional code; disabling it or replacing recovery codes requires fresh credential confirmation. Accounts that have not enabled it remain usable when this configuration is absent.')}</LegalP>
        <LegalP>{t('已收到的联系人可能有自己的副本；注销或删帖无法撤回他人自行保存的内容。非私密安全审计保留去标识案例与操作时间。托管日志、备份、第三方图片存储及缓存有独立的保留与清理流程，不保证与在线账号同时消失；需要人工处理的请求可联系页末邮箱。未经可信上传归属验证，不会仅凭提交的图片网址删除第三方资源。', 'Recipients may retain their own copies; deletion cannot withdraw content they independently saved. Non-private safety audit records retain anonymized cases and action times. Hosting logs, backups, third-party image storage and caches have separate retention and cleanup processes and are not guaranteed to disappear with the online account. Contact the email below for requests needing manual handling. We do not delete third-party assets based solely on a submitted image URL without trusted upload ownership evidence.')}</LegalP>
      </LegalSection>
      <LegalSection title={t('实际服务提供方与通知选择', 'Service providers and notification choices')}>
        <LegalP>{t('BAYLINK 使用 Vercel 托管网站、Render 运行 API、MongoDB Atlas 保存账号与业务记录、Cloudinary 保存上传的图片。这些服务会按其用途处理请求、相应记录或上传文件，并可能保留服务日志、备份或缓存。', 'BAYLINK uses Vercel for the website, Render for the API, MongoDB Atlas for account and service records, and Cloudinary for uploaded images. These services process requests, relevant records or uploads for those purposes and may retain service logs, backups or caches.')}</LegalP>
        <LegalP>{t('选择 AI 功能时，Anthropic（Claude 模型）处理该功能明确选取的输入；少数辅助功能（如从网页提取活动资料）在配置时可能由 OpenAI 处理；联网检索可能处理搜索词。启用路线估算时，Google Routes 处理公开地点、出行方式与请求的日期时间。交互地图使用 OpenFreeMap 图块；地图与路线请求不应填写私人家庭住址。站点不声称这些第三方会在账号注销时即时清除其日志。', 'When you choose AI features, Anthropic (Claude models) processes the input selected for that feature; a few helper features (such as extracting event details from web pages) may use OpenAI where configured; web retrieval may process search terms. When route estimates are enabled, Google Routes processes public places, travel mode and requested date/time. Interactive maps load OpenFreeMap tiles. Avoid entering private home addresses in map or route requests. We do not claim these providers instantly erase their logs when your account is deleted.')}</LegalP>
        <LegalP>{t('配置且需要发送邮件时，Resend 处理收件邮箱与邮件内容；配置且需要发送短信时，Twilio 处理电话号码与短信内容。邮箱验证、账号恢复和手机号验证依其独立流程处理。可选消息、联系请求或小队通知需主动选择渠道及主题；邮箱须先验证，短信须使用已验证的号码。通知默认关闭，并取决于服务器是否启用投递。撤回通知同意不会取消账号登录或站内私信。', 'When configured email delivery is needed, Resend processes the destination address and message. When configured SMS delivery is needed, Twilio processes the phone number and SMS. Email verification, account recovery and phone verification follow their separate flows. Optional message, contact-request or group notifications require explicit channel and topic choices; email requires verification and SMS requires a verified number. Notifications default to off and depend on server delivery being enabled. Withdrawing notification consent does not disable sign-in or in-site messages.')}</LegalP>
        <LegalP>{t('为避免重复通知和核验真实首次请求的24小时回复，服务保存最少的账号、会话、帖子编号和相关时间，不复制私信正文到统计记录。通知队列保存目的、渠道、同意版本及投递状态；这些账号关联记录按模型到期或注销清理。产品统计只累加匿名每日计数，不识别活跃人数或个人留存。', 'To prevent duplicate notifications and verify responses within 24 hours of a real first request, the service stores minimal account, conversation and post references and timestamps, without copying private message text into metrics. Notification queues store purpose, channel, consent revision and delivery status; account-linked records expire under their model rules or are cleared on account deletion. Product reporting uses anonymous daily totals and does not identify active-user counts or individual retention.')}</LegalP>
      </LegalSection>
    </div>

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
      <LegalP>{t('客户端功能统计只按日期、界面语言和页面类型累计浏览、粗略来源、推荐、保存、分享、收藏、地图与官方链接操作次数，不识别个人或跨次访问。页面类型是「活动详情」「指南文章」这样的模板（例如 /events/:id），不含具体条目编号或查询内容。来源只分直接访问、搜索、微信、社交、分享卡、Opus与其他，不发送来源网址。统计请求不携带账号、会话编号、IP、问题正文、页面网址或精确位置；浏览器开启 Do Not Track 或 Global Privacy Control 时不发送这些客户端统计请求。聚合记录保留180天，不代表活跃人数、个人留存或回复百分比。', 'Client feature counters count page views, coarse entry-source categories, recommendations, saves, shares, favorites, map opens and official-link clicks by day, interface language and page type. A page type is a template such as "event detail" (/events/:id), without the item id or any search text. Source categories are direct, search, WeChat, social, card, Opus or other; the source URL is not sent. These requests contain no account/session identifier, IP address, question text, page URL or precise location. Do Not Track and Global Privacy Control stop these client counter requests. Aggregate records expire after 180 days and do not represent active-user counts, individual retention or response percentages.')}</LegalP>
      <LegalP>{t('服务端另累加已完成注册与真实消息请求及回复的匿名每日总数，不复制账号、联系方式或消息正文到匿名统计中。客户端统计开关不停止这些后台运营总数；为核验回复而保存的最少账号关联编号和时间遵循上文的清理范围。托管及安全日志也与客户端匿名计数分开。', 'The server separately counts completed registrations and real message requests/replies as anonymous daily totals, without copying account identifiers, contacts or message text into the aggregate. Client counter preferences do not stop these operational totals. Minimal account-linked references and timestamps needed to verify replies follow the cleanup boundaries above. Hosting and security logs are also separate from client anonymous counters.')}</LegalP>
    </LegalSection>
    <LegalSection title={t('意见反馈、错误统计与内测模式', 'Feedback, error reports and tester mode')}>
      <LegalP>{t('意见反馈（反馈表、「这条信息有误？」和 BayBay 回答下的原因）只发送：你选择的问题类型、你填写的文字（最多 500 字）和可选的联系方式、所在页面类型、相关条目编号（报告某条活动、优惠、新店或指南有误时）、界面语言、字号和网站版本。不附带网址、账号、IP 或 BayBay 对话。反馈不与账号关联，保存 90 天后自动删除；需要提前删除可写信到页末邮箱。为防止滥用，服务器按访客每天计数，只保存每天更换的单向摘要，不保存 IP。', 'Feedback (the feedback form, "Something wrong here?" and the reasons under a BayBay answer) sends only the problem type you choose, the text you type (up to 500 characters), an optional contact, the page type, the item id when you report an event, offer, opening or guide, and the interface language, text size and site version. It never includes the address, your account, your IP address or a BayBay conversation. Feedback is not linked to an account and is deleted automatically after 90 days; email the address below to have it removed sooner. To prevent abuse the server counts submissions per visitor per day using a one-way digest that changes daily, never the IP address.')}</LegalP>
      <LegalP>{t('页面出错时，浏览器只发送错误类型、页面类型、网站版本，以及由错误名称和部分错误信息生成的一串短摘要；错误原文、网址和你输入的内容都不会发送。服务器按天汇总计数，保存 30 天。浏览器开启 Do Not Track 或 Global Privacy Control 时不发送。', 'When a page fails, the browser sends only the error type, the page type, the site version and a short digest made from the error name and part of its message; the message itself, the address and anything you typed are never sent. The server keeps daily counts for 30 days. Do Not Track and Global Privacy Control stop these reports.')}</LegalP>
      <LegalP>{t('内测模式只在你打开带测试编号的链接（例如 ?tester=T07）并点「同意」后开启：之后 30 天，这台设备的页面上会显示反馈按钮，测试编号保存在本浏览器，并预先填入反馈表的联系方式一栏（可修改或删除）。浏览统计和错误统计不带测试编号。可随时在反馈表中退出，30 天后自动结束。', 'Tester mode starts only when you open a link with a tester code (for example ?tester=T07) and choose Agree. For the next 30 days pages on this device show a Feedback button; the code is stored in this browser and pre-filled into the contact field of the feedback form, where you can change or delete it. Page counts and error reports never carry the code. You can leave from the feedback form at any time, and it ends by itself after 30 days.')}</LegalP>
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
      <LegalP>{t('在线账号注销与上述去敏清理是独立可确认的操作。其余记录按提供服务、安全与必要核验的用途保留；我们尚未为每类托管日志、备份和历史第三方媒体公布统一固定期限，也不承诺即时清除。可通过页末联系方式申请人工核验、访问、更正或进一步清理。', 'Online account deletion and the anonymization described above are separate confirmable operations. Other records are retained for service, safety and necessary verification purposes. We have not published one fixed duration for every hosting-log, backup or historical third-party-media category and do not promise immediate erasure. Contact the address below for manually verified access, correction or further cleanup.')}</LegalP>
      <LegalP>{t('意见反馈保存 90 天，错误统计保存 30 天，匿名功能统计保存 180 天，到期自动删除。', 'Feedback is kept for 90 days, error reports for 30 days and anonymous feature counts for 180 days, then deleted automatically.')}</LegalP>
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
        <a href="mailto:Baylink.us@gmail.com" className="font-normal text-baylink-green hover:underline">Baylink.us@gmail.com</a>
      </LegalP>
    </LegalSection>
  </LegalPageLayout>
  );
};
