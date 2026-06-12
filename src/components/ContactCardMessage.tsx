import { Copy, Shield } from 'lucide-react';

type ContactMethod = {
  type: string;
  label?: string;
  value: string;
  note?: string;
};

type ContactCardMessageProps = {
  methods: ContactMethod[];
  isMine?: boolean;
  onCopied?: (message: string, type?: 'success' | 'error' | 'info') => void;
};

const typeLabel = (type: string, label?: string) => {
  if (label?.trim()) return label;
  if (type === 'wechat') return '微信';
  if (type === 'phone') return '电话';
  if (type === 'email') return '邮箱';
  return '联系方式';
};

export const ContactCardMessage = ({ methods, isMine, onCopied }: ContactCardMessageProps) => {
  const copy = async (value: string) => {
    if (!value?.trim()) return;
    try {
      await navigator.clipboard.writeText(value.trim());
      onCopied?.('已复制');
    } catch {
      onCopied?.('复制失败', 'error' as const);
    }
  };

  return (
    <div className={`max-w-[85%] rounded-2xl border p-3.5 shadow-rest ${isMine ? 'border-baylink-green/20 bg-baylink-green-light/40' : 'border-black/[0.06] bg-white'}`}>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-baylink-green">
        <Shield size={14} />
        BAYLINK 联系方式卡片
      </div>
      <div className="space-y-2">
        {methods.map((m, i) => (
          <div key={`${m.type}-${i}`} className="rounded-xl border border-black/[0.04] bg-white/80 px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-baylink-muted">{typeLabel(m.type, m.label)}</div>
                <div className="mt-0.5 break-all text-sm font-semibold text-baylink-text">{m.value}</div>
                {m.note && <div className="mt-0.5 text-[11px] text-baylink-muted">{m.note}</div>}
              </div>
              <button
                type="button"
                onClick={() => copy(m.value)}
                disabled={!m.value?.trim()}
                className="shrink-0 rounded-lg border border-black/[0.06] bg-white p-1.5 text-baylink-muted transition hover:text-baylink-green disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="复制"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[10px] leading-relaxed text-baylink-muted">
        建议先确认身份、价格、时间和交易方式。涉及押金、预付款或上门服务时请谨慎。
      </p>
    </div>
  );
};
