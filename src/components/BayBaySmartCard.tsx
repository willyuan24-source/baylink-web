import { useState, useCallback } from 'react';
import { Shield, Check } from 'lucide-react';

export type BayBayCardAction = {
  label: string;
  type: 'category' | 'guide' | 'post' | 'postAssist';
  url?: string;
  postType?: 'client' | 'provider';
  category?: string;
};

export type BayBayInteractiveCard = {
  id: string;
  type: 'checklist' | 'safety';
  title: string;
  subtitle?: string;
  items: { id: string; label: string }[];
  actions?: BayBayCardAction[];
};

type BayBaySmartCardProps = {
  card: BayBayInteractiveCard;
  onAction: (action: BayBayCardAction) => void;
};

export const BayBaySmartCard = ({ card, onAction }: BayBaySmartCardProps) => {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());

  const toggleItem = useCallback((itemId: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const isChecklist = card.type === 'checklist';

  return (
    <div className="mt-2 rounded-2xl border border-baylink-green/10 bg-white p-3.5 shadow-rest">
      <div className="flex items-start gap-2">
        {!isChecklist && (
          <Shield size={14} className="mt-0.5 shrink-0 text-baylink-green/80" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <span className="mb-1 inline-block rounded-full bg-baylink-green/[0.08] px-2 py-0.5 text-[10px] font-semibold text-baylink-green">
            BayBay 行动卡
          </span>
          <h4 className="text-[15px] font-semibold text-baylink-text leading-snug">{card.title}</h4>
          {card.subtitle && (
            <p className="mt-0.5 text-[12px] leading-[1.35] text-baylink-text-secondary">{card.subtitle}</p>
          )}
        </div>
      </div>

      <ul className={`mt-2 space-y-1 ${isChecklist ? '' : 'pl-0.5'}`}>
        {card.items.map((item) => {
          const checked = checkedIds.has(item.id);
          if (isChecklist) {
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className="flex w-full items-start gap-2 rounded-lg px-0.5 py-0.5 text-left transition hover:bg-baylink-section/30"
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                      checked
                        ? 'border-baylink-green bg-baylink-green text-white'
                        : 'border-baylink-border bg-white'
                    }`}
                    aria-hidden
                  >
                    {checked && <Check size={10} strokeWidth={3} />}
                  </span>
                  <span
                    className={`text-[13px] leading-snug text-baylink-text transition ${
                      checked ? 'text-baylink-muted line-through decoration-baylink-muted/40' : ''
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              </li>
            );
          }
          return (
            <li key={item.id} className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-baylink-green/60" aria-hidden />
              <span className="text-[13px] leading-snug text-baylink-text">{item.label}</span>
            </li>
          );
        })}
      </ul>

      {card.actions && card.actions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-baylink-border/30 pt-2">
          {card.actions.map((action, i) => (
            <button
              key={`${action.label}-${i}`}
              type="button"
              onClick={() => onAction(action)}
              className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition active:scale-[0.98] ${
                action.type === 'postAssist'
                  ? 'bg-baylink-green text-white shadow-rest hover:opacity-95'
                  : 'border border-baylink-border/50 bg-white text-baylink-text hover:border-baylink-green/30'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
