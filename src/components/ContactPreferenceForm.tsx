export type ContactPreferenceMode = 'dm_first' | 'auto_send' | 'manual_approve';

export type ContactMethodField = {
  type: 'wechat' | 'phone' | 'email' | 'other';
  label: string;
  value: string;
  note: string;
  enabled: boolean;
};

export type ContactPreferenceValue = {
  mode: ContactPreferenceMode;
  methods: ContactMethodField[];
};

type ContactPreferenceFormProps = {
  value: ContactPreferenceValue;
  onChange: (next: ContactPreferenceValue) => void;
};

const METHOD_ROWS: { type: ContactMethodField['type']; label: string; placeholder: string }[] = [
  { type: 'wechat', label: '微信', placeholder: '微信号' },
  { type: 'phone', label: '电话', placeholder: '手机号' },
  { type: 'email', label: '邮箱', placeholder: '邮箱地址' },
  { type: 'other', label: '其他', placeholder: '其他联系方式' },
];

const ensureMethods = (methods: ContactMethodField[]) => {
  const byType = new Map(methods.map((m) => [m.type, m]));
  return METHOD_ROWS.map((row) => byType.get(row.type) || {
    type: row.type,
    label: row.label,
    value: '',
    note: '',
    enabled: false,
  });
};

export const defaultContactPreference = (): ContactPreferenceValue => ({
  mode: 'dm_first',
  methods: ensureMethods([]),
});

export const ContactPreferenceForm = ({ value, onChange }: ContactPreferenceFormProps) => {
  const methods = ensureMethods(value.methods);
  const showMethods = value.mode === 'auto_send' || value.mode === 'manual_approve';

  const setMode = (mode: ContactPreferenceMode) => onChange({ ...value, mode, methods });

  const updateMethod = (type: ContactMethodField['type'], patch: Partial<ContactMethodField>) => {
    const next = methods.map((m) => (m.type === type ? { ...m, ...patch, enabled: patch.value !== undefined ? !!String(patch.value).trim() : m.enabled } : m));
    onChange({ ...value, methods: next });
  };

  return (
    <div className="rounded-2xl border border-baylink-border/60 bg-white p-3.5 space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-baylink-text">联系方式设置</h4>
        <p className="mt-1 text-[11px] leading-relaxed text-baylink-muted">
          推荐优先使用 BAYLINK 私信。需要提供微信、电话或邮箱时，可以让对方登录后请求，减少骚扰和诈骗。
        </p>
      </div>
      <div className="space-y-2">
        {([
          ['dm_first', '优先站内私信'],
          ['auto_send', '请求后自动发送联系方式'],
          ['manual_approve', '需要我确认后发送'],
        ] as const).map(([mode, label]) => (
          <label key={mode} className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${value.mode === mode ? 'border-baylink-green bg-baylink-green-light/40' : 'border-baylink-border'}`}>
            <input type="radio" name="contactMode" className="mt-0.5 accent-baylink-green" checked={value.mode === mode} onChange={() => setMode(mode)} />
            <span className="font-medium text-baylink-text">{label}</span>
          </label>
        ))}
      </div>
      {showMethods && (
        <div className="space-y-2 border-t border-baylink-border/40 pt-3">
          {METHOD_ROWS.map((row) => {
            const m = methods.find((x) => x.type === row.type)!;
            return (
              <div key={row.type}>
                <label className="mb-1 block text-[11px] font-medium text-baylink-text-secondary">{row.label}</label>
                <input
                  className="w-full rounded-xl border border-baylink-border/60 bg-baylink-bg-alt/50 px-3 py-2 text-sm outline-none focus:border-baylink-green/40"
                  placeholder={row.placeholder}
                  value={m.value}
                  onChange={(e) => updateMethod(row.type, { value: e.target.value, enabled: !!e.target.value.trim() })}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
