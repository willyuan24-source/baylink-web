import { useId } from 'react';
import { ModalShell } from '../../components/ui/Modal';
import { useLocale } from '../../i18n/locale';
import { say, type Copy } from './say';
import './feedback.css';

const COPY = {
  title: { zh: '参加 BAYLINK 内测', en: 'Join the BAYLINK test' },
  code: { zh: '你的测试编号：', en: 'Your tester code: ' },
  what: { zh: '同意后的 30 天里，这台设备的每个页面右下角会有一个「反馈」按钮，随时告诉我们哪里不好用。', en: 'For the next 30 days, every page on this device shows a Feedback button so you can tell us what is not working.' },
  code2: { zh: '反馈表的联系方式一栏会预先填好测试编号，方便站长联系你；你可以修改或删掉。', en: 'Your tester code is filled into the contact field of the feedback form so we can reach you. You can change or delete it.' },
  not: { zh: '我们不会因此收集你的账号、浏览的网址或你在其他地方输入的内容。浏览统计仍然是匿名的，不带测试编号。', en: 'Joining does not collect your account, the addresses you visit or anything you type elsewhere. Page counts stay anonymous and never carry the code.' },
  leave: { zh: '随时可以在反馈表里退出内测；30 天后自动结束。', en: 'You can leave the test from the feedback form at any time. It ends by itself after 30 days.' },
  agree: { zh: '同意，开始内测', en: 'Agree and start' },
  decline: { zh: '不参加', en: 'No, thanks' },
  privacy: { zh: '隐私说明', en: 'Privacy' },
} satisfies Record<string, Copy>;

/** Shown once for a ?tester= link. Nothing is stored unless the reader agrees (G10 test mode, quality.md §5). */
export default function TesterConsentSheet({ code, onAgree, onDecline }: { code: string; onAgree: () => void; onDecline: () => void }) {
  const locale = useLocale();
  const t = (copy: Copy) => say(copy, locale);
  const id = useId();
  return <ModalShell onClose={onDecline} closeOnBackdrop={false} className="feedback-overlay" labelledBy={`${id}title`}>
    <div className="feedback-sheet feedback-consent">
      <header className="feedback-sheet-header"><h2 id={`${id}title`}>{t(COPY.title)}</h2></header>
      <p className="feedback-consent-code">{t(COPY.code)}<strong translate="no">{code}</strong></p>
      <ul>
        <li>{t(COPY.what)}</li>
        <li>{t(COPY.code2)}</li>
        <li>{t(COPY.not)}</li>
        <li>{t(COPY.leave)}</li>
      </ul>
      <p className="feedback-attached"><a href="/privacy" target="_blank" rel="noopener">{t(COPY.privacy)}</a></p>
      <div className="feedback-actions">
        <button type="button" className="feedback-primary" onClick={onAgree}>{t(COPY.agree)}</button>
        <button type="button" className="feedback-secondary" onClick={onDecline}>{t(COPY.decline)}</button>
      </div>
    </div>
  </ModalShell>;
}
