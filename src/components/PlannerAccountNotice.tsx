import { Link } from 'react-router-dom';
import type { usePlannerLibrary } from '../lib/planner-library';
import { translateText, useLocale } from '../i18n/locale';

export function PlannerAccountNotice({ library, signedIn, login, variant = 'default' }: { library: ReturnType<typeof usePlannerLibrary>; signedIn: boolean; login?: () => void; variant?: 'default' | 'week' }) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const compact = variant === 'week';
  // On the library page, keep only actionable storage/import/error information.
  if (compact && signedIn && !library.guestCount && !library.error) return null;
  return <div className={`planner-account${compact ? ' planner-account-compact' : ''}`}>
    {!compact ? <div><strong>{signedIn ? t('计划跟着账号走', 'Your plans follow your account') : t('先计划，再决定是否登录', 'Plan first, sign in when ready')}</strong><p>{signedIn ? t('保存后可在其他设备的「我的这周」继续。', 'Save and continue in My Week on another device.') : t('访客计划只存在这个浏览器；登录后可自行选择导入账号。', 'Guest plans stay in this browser. After signing in, you can choose to import them.')}</p></div>
      : !signedIn ? <p>{t('访客计划只保存在这个浏览器。登录后可选择导入账号。', 'Guest plans stay in this browser. Sign in to choose whether to import them.')}</p>
        : library.guestCount > 0 ? <p>{t('此浏览器还有访客计划或收藏，导入后才会加入当前账号。', 'This browser has guest plans or saved items. Import them to add them to this account.')}</p> : null}
    {signedIn ? !compact && <Link to="/my-week">{t('我的这周', 'My Week')}</Link> : <button type="button" onClick={login}>{compact ? t('登录后选择同步', 'Sign in to choose sync') : t('登录并同步', 'Sign in and sync')}</button>}
    {signedIn && library.guestCount > 0 && <button type="button" disabled={library.busy || library.loading || !library.ready} onClick={() => void library.importGuest()}>{t('导入本机访客计划与收藏', 'Import guest plans and saved items')}</button>}
    {library.error && <p role="alert" className="planner-error">{translateText(library.error, locale)} <button type="button" disabled={library.busy || library.loading} onClick={() => void library.refresh()}>{signedIn ? t('刷新账号资料', 'Refresh account data') : t('重新读取本机计划', 'Reload browser plans')}</button></p>}
  </div>;
}
