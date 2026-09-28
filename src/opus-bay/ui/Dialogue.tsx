import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Fish, Footprints, ShoppingBasket, TramFront, Users } from 'lucide-react';
import { runtime } from '../core/runtime';
import { useGame } from '../core/store';
import type { DialogueNode } from '../core/types';
import { CHOICE_SUBS, NPC_LINES, START_NODE } from '../data/script';
import { advanceDialogue, chooseDialogue, closeDialogue, nodeById, noteInteractHandled, setDialogueConfirm } from '../game/flow';
import { NPC_POSTS } from '../game/interactables';
import { useT } from '../i18n';
import { BaybayFace, Keycap } from './common';
import { portraitSrc, useDevice, useWindowKey } from './hooks';
import './content-ui.css';

/** Bottom dialogue box: portrait, name, typewriter text (skippable), choices with number hotkeys. */
export function Dialogue() {
  const nodeId = useGame(s => s.dialogue.nodeId);
  const node = nodeById(nodeId);
  if (!node || !nodeId) return null;
  return <DialogueBox key={nodeId} node={node} />;
}

function DialogueBox({ node }: { node: DialogueNode }) {
  const { t, locale } = useT();
  const device = useDevice();
  const reduced = useGame(s => s.settings.reducedMotion);
  const text = t(node.text);
  const [shown, setShown] = useState(reduced ? text.length : 0);
  const done = shown >= text.length;
  const choicesRef = useRef<HTMLDivElement>(null);
  const choices = node.choices ?? [];

  useEffect(() => {
    if (done) return;
    const perSecond = locale === 'en' ? 62 : 30;
    const stepMs = 33;
    const id = window.setInterval(() => setShown(n => Math.min(text.length, n + Math.max(1, Math.round((perSecond * stepMs) / 1000)))), stepMs);
    return () => window.clearInterval(id);
  }, [done, text, locale]);

  useEffect(() => {
    if (done && choices.length && device !== 'touch') choicesRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }, [done, choices.length, device]);

  const next = () => {
    noteInteractHandled();
    if (!done) { setShown(text.length); return; }
    if (!choices.length) advanceDialogue();
  };

  // Gamepad / action button: A confirms (finish text → pick the focused choice → advance);
  // the d-pad or left stick moves the focus between choices.
  const confirmRef = useRef(() => {});
  useLayoutEffect(() => {
    confirmRef.current = () => {
      if (!done || !choices.length) { next(); return; }
      const buttons = [...(choicesRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      noteInteractHandled();
      chooseDialogue(Math.max(0, index));
    };
  });
  useEffect(() => {
    const confirm = () => confirmRef.current();
    setDialogueConfirm(confirm);
    return () => setDialogueConfirm(null);
  }, []);
  useEffect(() => {
    if (device !== 'gamepad' || !done || !choices.length) return;
    let rest = true;
    const id = window.setInterval(() => {
      const y = runtime.input.moveY, x = runtime.input.moveX;
      const push = Math.abs(y) > 0.5 ? -Math.sign(y) : Math.abs(x) > 0.5 ? Math.sign(x) : 0;
      if (!push) { rest = true; return; }
      if (!rest) return;
      rest = false;
      const buttons = [...(choicesRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
      if (!buttons.length) return;
      const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[(Math.max(0, at) + push + buttons.length) % buttons.length].focus({ preventScroll: true });
    }, 90);
    return () => window.clearInterval(id);
  }, [device, done, choices.length]);

  useWindowKey(e => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const onButton = !!target?.closest?.('.ob-dialogue button');
      if (/^Digit[1-9]$/.test(e.code) || /^Numpad[1-9]$/.test(e.code)) {
        const n = Number(e.code.slice(-1));
        const index = choices.findIndex((choice, i) => (choice.hotkey ?? String(i + 1)) === String(n));
        if (index >= 0) { e.preventDefault(); noteInteractHandled(); chooseDialogue(index); }
        return;
      }
      if (e.code === 'KeyE' || ((e.code === 'Enter' || e.code === 'Space') && !onButton)) { e.preventDefault(); next(); return; }
      if (e.code === 'Escape' && !choices.length) { e.preventDefault(); e.stopPropagation(); noteInteractHandled(); if (!done) setShown(text.length); else closeDialogue(); }
  });

  const speaker = node.speaker;
  const name = speaker === 'baybay' ? 'BAYBAY' : speaker === 'npc' ? (node.npcName ? t(node.npcName) : t('路人', 'Local')) : speaker === 'player' ? t('你', 'You') : null;
  const key = speaker === 'npc' ? npcKey(node) : undefined;
  const npcPortrait = speaker === 'npc' ? (key ? portraitSrc(`npc-${key}`) : undefined) ?? portraitSrc('npc')
    : speaker === 'player' ? portraitSrc('player') ?? portraitSrc('newcomer') : undefined;
  const welcome = node.id === START_NODE;

  return (
    <div className={`ob-dialogue speaker-${speaker}`} role="dialog" aria-live="polite" aria-label={name ?? t('旁白', 'Narration')}>
      {speaker !== 'narrator' && (
        <div className="ob-dialogue-portrait">
          {speaker === 'baybay' ? <BaybayFace mood={node.mood ?? 'happy'} size={92} /> : npcPortrait ? <img src={npcPortrait} alt="" width={92} height={92} className="ob-face" /> : <span className={`ob-avatar-fallback ${speaker}`} aria-hidden>{speaker === 'player' ? t('你', 'You') : <NpcGlyph en={node.npcName?.en} fallback={(name ?? '?').slice(0, 1)} />}</span>}
        </div>
      )}
      <div className="ob-dialogue-box" onClick={e => { if ((e.target as HTMLElement).closest('button')) return; next(); }}>
        {name && <span className="ob-dialogue-name">{name}</span>}
        <p className="ob-dialogue-text">
          <span>{text.slice(0, shown)}</span>
          <span className="ob-dialogue-ghost" aria-hidden>{text.slice(shown)}</span>
        </p>
        {choices.length > 0 ? (<>
          <div ref={choicesRef} className={`ob-choices ${done ? 'is-in' : ''} ${choices.length > 3 ? 'is-grid' : ''}`} role="group" aria-label={t('选择', 'Choices')}>
            {choices.map((choice, i) => (
              <button key={i} type="button" className="ob-choice" onClick={() => { noteInteractHandled(); chooseDialogue(i); }} tabIndex={done ? 0 : -1}>
                <span className="ob-choice-key">{choice.hotkey ?? i + 1}</span>
                <span className="ob-choice-label">
                  <span>{t(choice.label)}</span>
                  {CHOICE_SUBS[`${node.id}:${choice.hotkey ?? i + 1}`] && <small className="ob-choice-sub">{t(CHOICE_SUBS[`${node.id}:${choice.hotkey ?? i + 1}`])}</small>}
                </span>
              </button>
            ))}
          </div>
          {welcome && done && <p className="ob-dialogue-foot">{device === 'touch' ? t('点我的头像随时换玩法', 'Tap my portrait to switch anytime') : t('随时按 Q / 点我的头像换玩法', 'Press Q or click my portrait to switch anytime')}</p>}
        </>) : (
          <div className={`ob-dialogue-next ${done ? 'is-in' : ''}`} aria-hidden>
            {device === 'touch' ? t('点一下继续', 'Tap to continue') : <><Keycap>{device === 'gamepad' ? 'A' : 'E'}</Keycap>{t('继续', 'Continue')}</>}
            <span className="ob-caret" />
          </div>
        )}
      </div>
    </div>
  );
}

/** Which resident is speaking: from the node id (npc.<key>, flow.npc.<key>) or the speaker's name. */
function npcKey(node: DialogueNode): string | undefined {
  const fromId = /^(?:flow\.)?npc\.([a-z-]+)/.exec(node.id)?.[1];
  if (fromId) return fromId;
  const en = node.npcName?.en;
  if (!en) return undefined;
  return NPC_LINES.find(line => line.name.en === en)?.key ?? NPC_POSTS.find(post => post.name.en === en)?.key;
}

/** Toy-badge glyph for residents without a portrait (vendor, angler, streetcar operator, family, jogger). */
function NpcGlyph({ en = '', fallback }: { en?: string; fallback: string }) {
  const who = en.toLowerCase();
  const props = { size: 38, strokeWidth: 2, 'aria-hidden': true as const };
  if (/stall|vendor|market/.test(who)) return <ShoppingBasket {...props} />;
  if (/angler|fish/.test(who)) return <Fish {...props} />;
  if (/streetcar|operator|driver/.test(who)) return <TramFront {...props} />;
  if (/visit|family|tourist/.test(who)) return <Users {...props} />;
  if (/run|jog/.test(who)) return <Footprints {...props} />;
  return <>{fallback}</>;
}
