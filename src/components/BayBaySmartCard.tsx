import { useState, useCallback } from 'react';
import { Shield, Check } from 'lucide-react';
import { linkifyPhones } from '../lib/phone-links';
import { translateText, useLocale } from '../i18n/locale';
import { Button } from './ui/Button';

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

/**
 * A checklist or safety card in an answer (UI9-BB): the panel's type and spacing tokens, F's buttons (the post helper is
 * the card's one primary), no Tailwind sizes, shadows or radii.
 */
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
  const locale = useLocale();
  // Numbers in a safety card's lines are tap-to-call (G27); a checklist line is a button, so it keeps plain text.
  const reader = (text: string) => linkifyPhones(translateText(text, locale));

  return (
    <div className="bb-smart" data-type={card.type}>
      <div className="bb-smart__head">
        {!isChecklist && <Shield size={20} aria-hidden />}
        <div>
          <span className="bb-smart__tag">BayBay 行动卡</span>
          <h4>{card.title}</h4>
          {card.subtitle && <p>{reader(card.subtitle)}</p>}
        </div>
      </div>

      <ul className="bb-smart__items">
        {card.items.map((item) => {
          const checked = checkedIds.has(item.id);
          if (isChecklist) {
            return (
              <li key={item.id}>
                <button type="button" aria-pressed={checked} onClick={() => toggleItem(item.id)}>
                  <span className="bb-smart__box" aria-hidden>{checked && <Check size={16} />}</span>
                  <span>{item.label}</span>
                </button>
              </li>
            );
          }
          return <li key={item.id}><span>{reader(item.label)}</span></li>;
        })}
      </ul>

      {card.actions && card.actions.length > 0 && (
        <div className="bb-actions">
          {card.actions.map((action, i) => (
            <Button key={`${action.label}-${i}`} variant={action.type === 'postAssist' ? 'primary' : 'secondary'} onClick={() => onAction(action)}>{action.label}</Button>
          ))}
        </div>
      )}
    </div>
  );
};
