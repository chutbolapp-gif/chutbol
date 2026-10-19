// Hebrew (default language). Wording follows the prototype (docs/prototype/soccerfriends.html).
// ratePart and ovrStyle must match the prototype text exactly: test/i18n.test.ts checks them
// against packages/scoring/test/helpers.ts (partLabelHe, STYLE_HE).
export const he = {
  app: {
    name: 'Chutbol',
    title: "הליגה של החבר'ה",
    tagline: 'מחזורים, טבלה שנתית, מלך שערים ומלך בישולים.',
  },
  common: {
    back: 'חזרה',
    close: 'סגור',
    total: 'סה״כ',
    loading: 'טוען…',
  },
  lang: {
    /** label of the toggle button: the language you switch TO */
    toggle: 'EN',
    toggleA11y: 'Language',
    reloadFailed: 'לא הצלחנו לטעון מחדש. סגור ופתח את האפליקציה כדי להחליף שפה.',
  },
  home: {
    demoTitle: '⭐ ציוני המשחק',
    demoHint: 'נתונים אמיתיים ממחזור {{n}}, מחושבים באפליקציה.',
  },
  demo: {
    round: 'מחזור {{n}}',
    matchRatings: 'ציוני משחק {{n}}',
    matchLine: 'משחק {{n}}: {{home}} {{h}} - {{a}} {{away}}',
    tapHint: 'לחיצה על שחקן מראה איך חושב ציון המשחק. רק אתה רואה את הפירוט.',
    devNote: 'מסך בדיקה של שלב 0ב: מראה שחבילת הציונים רצה בתוך האפליקציה.',
    gk: 'שוער',
  },
  ratePart: {
    base: 'בסיס',
    draw00: 'תיקו 0-0: בסיס 5.5',
    teamScored: 'הקבוצה כבשה {{n}} (0.5 לשער)',
    teamConceded: 'הקבוצה ספגה {{n}} (0.5- לשער)',
    gkConceded: '🧤 ספג {{n}} (שער אחד = 5.5, כל שער נוסף −0.5)',
    cleanSheet: '🧤 שער נקי, שוחקו {{pct}}% מהמשחק',
    cleanSheetShort: '🧤 שער נקי, אבל שוחקו רק {{pct}}% (פחות מ-30%)',
    goals: '⚽ {{n}} גולים',
    assists: '👟 {{n}} בישולים',
    saves: '🧤 {{n}} הצלות',
    lateWinner: '⏱ גול ניצחון בדקה האחרונה',
    lateWinnerAssist: '⏱ בישול לגול ניצחון בדקה האחרונה',
    fastWin: '⚡ ניצחון מהיר ({{time}} דקות)',
    lowTableWin: '📊 נמוכה בטבלת המחזור ({{pts}} מול {{oppPts}} נק׳), ניצחה (כפול)',
    lowTableDraw: '📊 נמוכה בטבלת המחזור ({{pts}} מול {{oppPts}} נק׳), תיקו',
    clampMin: 'הציון המינימלי הוא 4',
    clampMax: 'הציון המקסימלי הוא 10',
  },
  ovrStyle: {
    gk: 'שוער',
    complete: 'שחקן שלם',
    attacking: 'התקפי',
    defensive: 'הגנתי',
    engine: 'מנוע',
    balanced: 'מאוזן',
  },
};

type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };
/** Every language file must have exactly the keys of the Hebrew one. */
export type Dict = Shape<typeof he>;
