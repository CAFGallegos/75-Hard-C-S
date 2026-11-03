// The playful in-app notes. Used only where Carlos asked for them (Board note,
// Today milestones). In these notes Los is "Eduardo"; everywhere serious he stays "Los".
// Mirrors supabase/functions/_shared/voice.ts for the notification lines.

const SUE = {
  board: "A ver quién gana… señorita",
  missed: "Uff, te va a ganar Eduardo. Jaja, pero síguele.",
  ahead: "Vas ganando. No te confíes.",
  behind: null,
  milestones: { 25: "Un tercio. Vamos bien, bb.", 50: "Ya casi, mi amor.", 75: "Lo logramos." },
};

const LOS = {
  board: "A ver quién gana… cabrón",
  missed: "Te está ganando. Ponte las pilas, cabrón.",
  ahead: null,
  behind: "Vas perdiendo contra la señorita.",
  milestones: { 25: "Un tercio. No aflojes.", 50: "Ya casi. Ni se te ocurra rajarte.", 75: "Lo lograste, cabrón." },
};

export const voice = (id) => (id === "sue" ? SUE : LOS);

/**
 * One small note on the Board for the viewer, or null.
 * A fresh miss (the most recent finished day) wins; otherwise the standing:
 * Sue sees hers when she's ahead, Los sees his when he's behind.
 */
export function boardNote(meId, mine, theirs) {
  const v = voice(meId);
  if (!mine.started) return null;
  if (mine.lastClosedMissed) return v.missed;
  if (v.ahead && mine.completed > theirs.completed) return v.ahead;
  if (v.behind && mine.completed < theirs.completed) return v.behind;
  return null;
}

/** Milestone line for the day being viewed on Today, or null. */
export function milestoneNote(meId, s, day) {
  const v = voice(meId);
  if (s.finished && (day === s.finishedOn || day > s.finishedOn)) return v.milestones[75];
  if (s.milestones[50] === day) return v.milestones[50];
  if (s.milestones[25] === day) return v.milestones[25];
  return null;
}
