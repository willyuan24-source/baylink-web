import { ModalShell } from './ui/Modal';

export const PostNotFoundView = ({ onBack }: { onBack: () => void }) => (
  <ModalShell onClose={onBack} label="内容不可访问" className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-baylink-bg p-6">
    <p className="text-lg font-bold text-baylink-text">内容不存在或已被移除。</p>
    <p className="mt-2 text-sm text-baylink-muted">链接可能已失效，或内容已被管理员处理</p>
    <button type="button" onClick={onBack} className="mt-6 rounded-xl bg-baylink-green px-6 py-3 text-sm font-bold text-white">返回</button>
  </ModalShell>
);
