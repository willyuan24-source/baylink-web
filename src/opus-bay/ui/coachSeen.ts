/** F2 · whether the onboarding coach mark has done its job on this device (ui/CoachMark, ui/CoachMarkBody). */
const COACH_KEY = 'opus-bay:coach:v1';

export const coachSeen = () => { try { return localStorage.getItem(COACH_KEY) === '1'; } catch { return false; } };
export const markCoachSeen = () => { try { localStorage.setItem(COACH_KEY, '1'); } catch { /* storage blocked: session only */ } };
