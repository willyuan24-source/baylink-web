import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Ellipsis, Fish, Footprints, ShoppingBasket, TramFront, Users } from 'lucide-react';
import { runtime } from '../core/runtime';
import { game, useGame } from '../core/store';
import type { DialogueNode } from '../core/types';
import { CHOICE_SUBS, NPC_LINES, START_NODE } from '../data/script';
import { onWriteFailure } from '../data/save';
import { advanceDialogue, chooseDialogue, closeDialogue, nodeById, noteInteractHandled, say, setDialogueConfirm } from '../game/flow';
import { NPC_POSTS, setFocusWeight } from '../game/interactables';
import { useT } from '../i18n';
import { ASK_MENU_ID, BACK_LABEL, MORE_LABEL, cancelIndex, menuPages, type MenuRow } from './askMenu';
import { installBackGuard } from './backGuard';
import { BaybayFace, Keycap } from './common';
import { installFocusTrap } from './focusTrap';
import { interactWeight } from './interactPriority';
import { applyTextSize } from './textSize';
import { portraitSrc, useDevice, useWindowKey } from './hooks';
import { askItems } from './slots';
import './content-ui.css';

/** Bottom dialogue box: portrait, name, typewriter text (skippable), choices with number hotkeys. */
export function Dialogue() {
  usePlayA11y();
  const nodeId = useGame(s => s.dialogue.nodeId);
  const node = nodeById(nodeId);
  if (!node || !nodeId) return null;
  return <DialogueBox key={nodeId} node={node} />;
}

/** W9-A (review R§6 技术): the one notice when this visit's progress cannot be saved (data/save.ts onWriteFailure). */
const STORAGE_NOTICE = { zh: '这次的进度无法保存（浏览器禁止了存储）', en: 'Your progress can’t be saved this time (the browser blocks storage).' } as const;

/**
 * W9-A · the play layer's keyboard / back-button / robustness helpers, installed once while it is mounted (this component
 * is always rendered after the title): the focus trap of the aria-modal dialogs (ui/focusTrap.ts), the back button that
 * closes the open thing first (ui/backGuard.ts), the city's E priority (ui/interactPriority.ts), the stored text size
 * (ui/textSize.ts) and the storage notice — said once, after Start.
 */
function usePlayA11y() {
  useEffect(() => {
    const offTrap = installFocusTrap();
    const offBack = installBackGuard();
    setFocusWeight(interactWeight);
    applyTextSize(); // Settings › 文字大小 (ui/textSize.ts), as stored on this device
    let offPhase: (() => void) | null = null;
    const notice = () => say(STORAGE_NOTICE.zh, STORAGE_NOTICE.en, 'info', 7000);
    const offSave = onWriteFailure(() => {
      if (game.get().phase === 'playing') { notice(); return; }
      offPhase = game.subscribe(() => { if (game.get().phase === 'playing') { offPhase?.(); offPhase = null; notice(); } });
    });
    return () => { offTrap(); offBack(); offSave(); offPhase?.(); setFocusWeight(null); };
  }, []);
}

/** The key a menu row answers to on its page (a node's own hotkeys when it shows on one page in its own order). */
const rowKey = (row: MenuRow, k: number, node: DialogueNode, paged: boolean) =>
  !paged && row.kind === 'choice' ? node.choices?.[row.index]?.hotkey ?? String(k + 1) : String(k + 1);

function DialogueBox({ node }: { node: DialogueNode }) {
  const { t, locale } = useT();
  const device = useDevice();
  const reduced = useGame(s => s.settings.reducedMotion);
  const text = t(node.text);
  const [shown, setShown] = useState(reduced ? text.length : 0);
  const done = shown >= text.length;
  const choicesRef = useRef<HTMLDivElement>(null);
  const choices = useMemo(() => node.choices ?? [], [node]);
  // W9-A: the menu on screen — BAYBAY's call menu ≤ 6 rows + 更多…, any long menu paged; a digit key for every row
  const pages = useMemo(() => menuPages(node.id, choices), [node.id, choices]);
  const [page, setPage] = useState(0);
  const rows = pages[Math.min(page, pages.length - 1)] ?? [];
  const paged = pages.length > 1 || node.id === ASK_MENU_ID;
  const cancelAt = useMemo(() => cancelIndex(choices), [choices]);
  // the player moved the focus to a row themselves (Tab / arrows): Space then presses that row, as on any button
  const navigated = useRef(false);

  useEffect(() => {
    if (done) return;
    const perSecond = locale === 'en' ? 62 : 30;
    const stepMs = 33;
    const id = window.setInterval(() => setShown(n => Math.min(text.length, n + Math.max(1, Math.round((perSecond * stepMs) / 1000)))), stepMs);
    return () => window.clearInterval(id);
  }, [done, text, locale]);

  useEffect(() => {
    if (done && choices.length && device !== 'touch') choicesRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }, [done, choices.length, device, page]);

  const next = () => {
    noteInteractHandled();
    if (!done) { setShown(text.length); return; }
    if (!choices.length) advanceDialogue();
  };
  /** Esc / Space on a menu: its cancel row (没事，继续逛 · 先不用 …); a menu without one stays (the welcome, the questions) */
  const cancel = () => {
    if (cancelAt < 0) return;
    noteInteractHandled();
    chooseDialogue(cancelAt);
  };
  const act = (row: MenuRow | undefined) => {
    if (!row) return;
    noteInteractHandled();
    navigated.current = false;
    if (row.kind === 'more') setPage(p => Math.min(p + 1, pages.length - 1));
    else if (row.kind === 'back') setPage(p => Math.max(0, p - 1));
    else chooseDialogue(row.index);
  };
  const rowButtons = () => [...(choicesRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];

  // Gamepad / action button: A confirms (finish text → pick the focused row → advance);
  // the d-pad or left stick moves the focus between rows.
  const confirmRef = useRef(() => {});
  useLayoutEffect(() => {
    confirmRef.current = () => {
      if (!done || !choices.length) { next(); return; }
      const index = rowButtons().indexOf(document.activeElement as HTMLButtonElement);
      act(rows[Math.max(0, index)]);
    };
  });
  useEffect(() => {
    const confirm = () => confirmRef.current();
    setDialogueConfirm(confirm);
    return () => setDialogueConfirm(null);
  }, []);
  const moveFocus = (step: number) => {
    const buttons = rowButtons();
    if (!buttons.length) return;
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(Math.max(step > 0 ? -1 : 0, at) + step + buttons.length) % buttons.length].focus({ preventScroll: true });
  };
  useEffect(() => {
    if (device !== 'gamepad' || !done || !choices.length) return;
    let rest = true;
    const id = window.setInterval(() => {
      const y = runtime.input.moveY, x = runtime.input.moveX;
      const push = Math.abs(y) > 0.5 ? -Math.sign(y) : Math.abs(x) > 0.5 ? Math.sign(x) : 0;
      if (!push) { rest = true; return; }
      if (!rest) return;
      rest = false;
      moveFocus(push);
    }, 90);
    return () => window.clearInterval(id);
  }, [device, done, choices.length, page]); // eslint-disable-line react-hooks/exhaustive-deps -- moveFocus reads the DOM

  useWindowKey(e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const code = e.code;
      if (code === 'Tab' || code.startsWith('Arrow')) navigated.current = true;
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      const onButton = !!target?.closest?.('.ob-dialogue button');
      const viaBack = !!(e as KeyboardEvent & { obBack?: boolean }).obBack;
      if (choices.length) {
        const digit = /^(?:Digit|Numpad)([1-9])$/.exec(code)?.[1];
        if (digit) {
          const k = rows.findIndex((row, i) => rowKey(row, i, node, paged) === digit);
          if (k >= 0) { e.preventDefault(); act(rows[k]); }
          return;
        }
        if (done && (code === 'ArrowDown' || code === 'ArrowRight' || code === 'ArrowUp' || code === 'ArrowLeft')) { e.preventDefault(); moveFocus(code === 'ArrowDown' || code === 'ArrowRight' ? 1 : -1); return; }
        // Space never picks the row the menu focused for you: like Esc it cancels (a row you moved to yourself it presses)
        if (code === 'Escape' || (code === 'Space' && !(onButton && navigated.current))) {
          e.preventDefault(); e.stopPropagation();
          if (!done && code === 'Space') { next(); return; }
          cancel();
          return;
        }
        if (code === 'KeyE' || (code === 'Enter' && !onButton)) { e.preventDefault(); next(); }
        return;
      }
      if (code === 'KeyE' || ((code === 'Enter' || code === 'Space') && !onButton)) { e.preventDefault(); next(); return; }
      if (code === 'Escape') {
        e.preventDefault(); e.stopPropagation(); noteInteractHandled();
        // Esc first shows the whole line; the back button closes it at once (ui/backGuard.ts)
        if (!done && !viaBack) setShown(text.length); else closeDialogue();
      }
  });
  // a Space we turned into "cancel" never reaches the focused row's own click on keyup (Firefox clicks on keyup)
  useEffect(() => {
    const up = (e: KeyboardEvent) => { if (e.code === 'Space' && choices.length && !navigated.current && (e.target as HTMLElement | null)?.closest?.('.ob-dialogue button')) e.preventDefault(); };
    window.addEventListener('keyup', up, true);
    return () => window.removeEventListener('keyup', up, true);
  }, [choices.length]);

  const speaker = node.speaker;
  const name = speaker === 'baybay' ? 'BAYBAY' : speaker === 'npc' ? (node.npcName ? t(node.npcName) : t('路人', 'Local')) : speaker === 'player' ? t('你', 'You') : null;
  const key = speaker === 'npc' ? npcKey(node) : undefined;
  const npcPortrait = speaker === 'npc' ? (key ? portraitSrc(`npc-${key}`) : undefined) ?? portraitSrc('npc')
    : speaker === 'player' ? portraitSrc('player') ?? portraitSrc('newcomer') : undefined;
  const welcome = node.id === START_NODE;
  const menu = choices.length > 0;

  return (
    // W9-A: no aria-live here (the typewriter re-announced every step): flow's announce() says the whole line once
    // (ui/Floating LiveRegion) and the .ob-sr copy below is what a screen reader reads in the box. A menu is modal
    // (ui/focusTrap.ts keeps Tab inside it); data-ob-cancel tells the back button whether Escape can close it.
    <div className={`ob-dialogue speaker-${speaker}`} role="dialog" aria-modal={menu ? true : undefined} aria-label={name ?? t('旁白', 'Narration')} data-ob-cancel={!menu || cancelAt >= 0 ? '1' : '0'}>
      {speaker !== 'narrator' && (
        <div className="ob-dialogue-portrait">
          {speaker === 'baybay' ? <BaybayFace mood={node.mood ?? 'happy'} size={92} /> : npcPortrait ? <img src={npcPortrait} alt="" width={92} height={92} className="ob-face" /> : <span className={`ob-avatar-fallback ${speaker}`} aria-hidden>{speaker === 'player' ? t('你', 'You') : <NpcGlyph en={node.npcName?.en} fallback={(name ?? '?').slice(0, 1)} />}</span>}
        </div>
      )}
      <div className="ob-dialogue-box" onClick={e => { if ((e.target as HTMLElement).closest('button')) return; next(); }}>
        {name && <span className="ob-dialogue-name">{name}</span>}
        <p className="ob-dialogue-text">
          <span aria-hidden>{text.slice(0, shown)}</span>
          <span className="ob-dialogue-ghost" aria-hidden>{text.slice(shown)}</span>
          <span className="ob-sr">{text}</span>
        </p>
        {menu ? (<>
          <div ref={choicesRef} className={`ob-choices ${done ? 'is-in' : ''} ${rows.length > 3 ? 'is-grid' : ''}`} role="group" aria-label={t('选择', 'Choices')}>
            {rows.map((row, i) => {
              const k = rowKey(row, i, node, paged);
              if (row.kind !== 'choice') {
                return (
                  <button key={`${page}-${row.kind}`} type="button" className={`ob-choice is-${row.kind}`} onClick={() => act(row)} tabIndex={done ? 0 : -1}>
                    <span className="ob-choice-key">{k}</span>
                    <span className="ob-choice-label"><span>{row.kind === 'more' ? <span className="ob-choice-icon" aria-hidden><Ellipsis /></span> : <span className="ob-choice-icon" aria-hidden><ChevronLeft /></span>}{t(row.kind === 'more' ? MORE_LABEL : BACK_LABEL)}</span></span>
                  </button>
                );
              }
              const choice = choices[row.index];
              const sub = CHOICE_SUBS[`${node.id}:${choice.hotkey ?? row.index + 1}`];
              return (
                <button key={`${page}-${row.index}`} type="button" className="ob-choice" onClick={() => act(row)} tabIndex={done ? 0 : -1}>
                  <span className="ob-choice-key">{k}</span>
                  <span className="ob-choice-label">
                    <span>{choice.action?.type === 'ask' && <AskIcon id={choice.action.id} />}{t(choice.label)}</span>
                    {sub && <small className="ob-choice-sub">{t(sub)}</small>}
                  </span>
                </button>
              );
            })}
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

/** Wave 5 · a registered 问 BAYBAY item's icon (ui/slots.ts registerAskItem), before its label. */
function AskIcon({ id }: { id: string }) {
  const Icon = askItems.get(id)?.icon;
  return Icon ? <span className="ob-choice-icon" aria-hidden><Icon /></span> : null;
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
