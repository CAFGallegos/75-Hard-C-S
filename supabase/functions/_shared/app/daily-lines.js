// ============================================================================
//  Daily lines on Today (one per person per day).
//  Edit freely: add lines to any list, add dates, add day numbers.
//  Sue's lines are from Carlos to her. Los's are rough on purpose.
//
//  How a day's line is picked (see js/daily.js):
//    1. Final stretch (days left to the finish line), each shown only once.
//       No line on the finish day itself (the milestone shows instead).
//    2. Special day number (Day 1, Day 7, ...), then special date ("MM-DD").
//    3. Fri / Sat / Sun: a weekend line for that day.
//    4. Otherwise: the regular pool.
//  The pick comes from the date + the person, so every device shows the same
//  line, and no line repeats within NO_REPEAT_DAYS.
// ============================================================================

export const NO_REPEAT_DAYS = 10;

export const SUE = {
  pool: [
    "The volcano was harder.",
    "I know you're clumsy, but don't slip here.",
    "Eduardo ya se levantó. Dicen.",
    "Agua, enana.",
    "¿Quién te quiere? Yo. Ahora a darle.",
    "Ten pages. Not ten Instagram posts.",
    "Hoy tampoco hay pan dulce, señorita.",
    "Acatenango didn't beat us. This won't either.",
    "Poco a poco, enana.",
    "Eduardo dice que hoy te gana. Jaja.",
    "Drink water like you're mad at it.",
    "Outside workout. Yes, even if it's cold.",
    "Vas bien, bb.",
    "Una más que ayer.",
    "No te rajes, señorita.",
    "Remember the volcano. Everything's easy after that.",
    "Your future self says gracias.",
    "If you trip on the walk, that still counts as cardio.",
    "Que no se te olvide la foto, guapa.",
    "Eduardo se comió tu postre. Mentira.",
    "Hoy se vale quejarse. Pero lo haces igual.",
    "Te quiero. Ahora muévete.",
    "Lluvia no es excusa, señorita.",
    "Somebody has to beat Eduardo.",
  ],
  weekend: {
    fri: ["It's Friday. Still no margaritas.", "Viernes sin chelas. Ánimo, enana."],
    sat: ["Maybe a hike today?", "Weekend workouts count double. (They don't.)"],
    sun: ["Domingo de caminata, ¿o qué?", "Sunday reset. Water, walk, book."],
  },
};

export const LOS = {
  pool: [
    "Levántate, cabrón.",
    "Ella no se va a rajar. ¿Y tú?",
    "The volcano was harder. Quit whining.",
    "Nadie viene a salvarte, cabrón.",
    "Un galón. No es tequila.",
    "Ten pages. Not ten emails.",
    "Eduardo, ponte las pilas.",
    "Ella va ganando. Piénsalo.",
    "No cheat meals, cabrón. Ni un taco.",
    "Sal a caminar. Afuera. Con frío.",
    "Menos excusas, más agua.",
    "Hoy nadie te va a aplaudir. Hazlo igual.",
  ],
  weekend: {
    fri: ["Viernes. Sin chelas, cabrón."],
    sat: ["Hike or excuses. You pick."],
    sun: ["Domingo. Prepárate para la semana."],
  },
};

// Special day numbers (Day 1 = the start date).
export const SPECIAL_DAYS = {
  1: { sue: "Día uno, bb. Juntos.", los: "Día uno. Sin excusas." },
  7: { sue: "Una semana. ¿Quién te quiere?", los: "Una semana. Apenas empiezas." },
  30: { sue: "Un mes. Eduardo está impresionado.", los: "Un mes. No aflojes, cabrón." },
};

// Special calendar dates, "MM-DD".
const MESIVERSARIO = {
  sue: "Feliz mesiversario, bb. Ahora a entrenar.",
  los: "Mesiversario. Pórtate a la altura, cabrón.",
};
export const SPECIAL_DATES = {
  "11-14": MESIVERSARIO,
  "11-29": MESIVERSARIO,
  "12-14": MESIVERSARIO,
  "12-29": MESIVERSARIO,
  "01-14": MESIVERSARIO,
  "11-26": { sue: "Pavo sí. Pie no, señorita.", los: "Pavo sí. Pie no, cabrón." }, // Thanksgiving
  "12-24": { sue: "Nochebuena sin ponche con piquete. Te quiero igual.", los: "Nochebuena. Ni un tamal de más." },
  "12-25": { sue: "Feliz Navidad, enana.", los: "Feliz Navidad. Igual entrenas." },
  "12-31": { sue: "Año nuevo sin champaña. Qué romántico.", los: "Sin champaña. Aguanta, cabrón." },
  "01-01": { sue: "Año nuevo, mismo reto. Vamos, bb.", los: "Año nuevo. Misma disciplina." },
};

// Final stretch: keyed by days left after today until the finish line
// (1 = the finish is tomorrow). Uses the live finish line, so missed days push these back.
// Each shows only once, the first day that many days are left.
// The finish day itself gets no daily line: the "Lo logramos" milestone covers it.
export const FINAL_STRETCH = {
  5: { sue: "Cinco más, enana.", los: "Cinco más. No la riegues." },
  3: { sue: "Tres. Ya lo hueles.", los: "Tres. Termina fuerte." },
  1: { sue: "Mañana terminamos. ¿Quién te quiere?", los: "Mañana terminas. Hoy no te rajas." },
};
