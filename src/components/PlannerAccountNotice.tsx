import { Link } from 'react-router-dom';
import type { usePlannerLibrary } from '../lib/planner-library';

export function PlannerAccountNotice({ library, signedIn, login }: { library: ReturnType<typeof usePlannerLibrary>; signedIn: boolean; login?: () => void }) {
  return <div className="planner-account">
    <div><strong>{signedIn ? '计划跟着账号走' : '先计划，再决定是否登录'}</strong><p>{signedIn ? '保存后可在其他设备的「我的这周」继续。' : '访客计划只存在这个浏览器；登录后可自行选择导入账号。'}</p></div>
    {signedIn ? <Link to="/my-week">我的这周 ↗</Link> : <button onClick={login}>登录并同步</button>}
    {signedIn && library.guestCount > 0 && <button disabled={library.busy || library.loading} onClick={() => void library.importGuest()}>导入本机访客计划与收藏</button>}
    {library.error && <p role="alert" className="planner-error">{library.error} <button onClick={() => void library.refresh()}>刷新账号资料</button></p>}
  </div>;
}
