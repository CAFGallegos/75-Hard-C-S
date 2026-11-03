// The playful notification lines. Used only where Carlos asked for them:
// morning reminder, evening reminder (tasks still open), and "partner finished".
// In these notes Los is "Eduardo"; everywhere serious he stays "Los".
export interface Voice {
  morning: string;
  evening: string;
  partnerDone: string; // sent to this person when the OTHER person finishes their day
}

const SUE: Voice = {
  morning: "Buenos días, bb. A darle.",
  evening: "Falta poquito, muchachita. ¿O vas a dejar que te gane yo?",
  partnerDone: "Eduardo ya terminó. ¿Y tú, señorita?",
};

const LOS: Voice = {
  morning: "Levántate, cabrón. Ella ya va.",
  evening: "¿Qué esperas, cabrón? Termina.",
  partnerDone: "Sue ya terminó. ¿Y tú qué, cabrón?",
};

export const voice = (personId: string): Voice => (personId === "sue" ? SUE : LOS);
