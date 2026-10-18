# שלב 0א – תוכנית עבודה (חבילת הציונים)

מצב: תוכנית לאישור. לא נכתב עדיין קוד בפרויקט.

## ממצא חשוב לפני הכל: הציונים השמורים לא תואמים לנוסחה הנוכחית

הרצתי את הפונקציות המקוריות של אב-הטיפוס (בלי לשנות אותן) על הנתונים שלך.
מתוך 190 ציוני משחק ששמורים בקבצי המחזורים, **53 שונים** ממה שהנוסחה הנוכחית מחשבת.
כמעט כולם במחזור 6 (wvwdfkwkos1). הסיבה: הנוסחה השתנתה אחרי הערב.

| כמה | ההבדל | מה השתנה |
| --- | --- | --- |
| 26 | +0.5 | כלל חדש: תיקו 0-0 = בסיס 5.5 לשחקני שדה |
| 17 | +0.5 עד +1.5 | כלל ספיגה חדש לשוער (שער ראשון = 5.5, כל שער נוסף −0.5) |
| ~10 | ±0.5 עד ±1.5 | זיהוי מי שוער השתנה (פחות מדקה בשער כבר לא נחשב שוער) |

למה זה חשוב: מלך השערים, ה-MVP וה-OVR מחושבים מתוך **הציונים השמורים**, לא מחדש.
אב-הטיפוס עצמו מחשב מחדש ושומר כל פעם שמנהל שומר את המחזור, כך שהציונים הישנים הם "שאריות".

**ההמלצה שלי:** הנוסחה הנוכחית היא האמת. קבצי ה-golden ייבנו כך:
1. rateMatch: לפי הנוסחה הנוכחית (זה מה שהאפליקציה החדשה תחשב).
2. roundScores, OVR וכל השאר: מריצים אחרי "שמירה מחדש" של המחזור, כלומר בדיוק מה שאב-הטיפוס היה מציג אילו שמרת את המחזור היום.
3. דוח הפערים נשמר בקובץ, כדי שתדע מה ישתנה לשחקנים בטבלה.

החלופה: לשמור את הציונים הישנים כפי שהם (מה שהשחקנים ראו באותו ערב) ולהשתמש בנוסחה החדשה רק מכאן והלאה. זה מסבך את הייבוא ולא מומלץ.

## 1. הקמת הפרויקט

```
chutbol-kit/
  package.json, pnpm-workspace.yaml, tsconfig.base.json
  packages/shared/      טיפוסים בלבד (Round, Match, Event, League, RatingsDoc ...)
  packages/scoring/     הפונקציות + בדיקות Vitest + golden/
  scripts/extract-golden/
  apps/mobile/          שמור, ריק (שלב 0ב)
  supabase/             שמור, ריק (שלב 1א)
```

TypeScript במצב strict, Vitest, pnpm workspaces. אין שום חשבון חיצוני.

## 2. מפת תלויות (מחושבת אוטומטית, מודעת להיקפי משתנים)

הסגירה המלאה של 6 הפונקציות היא **42 סמלים**. מספרי השורות מ-soccerfriends.html.

| שורה | שם | תלוי ב | בעיה לטיפול |
| --- | --- | --- | --- |
| 374 | S | | מצב גלובלי של האפליקציה |
| 468 | leagueRounds | S | קורא S.rounds → יקבל רשימת מחזורים כפרמטר |
| 471 | team | | |
| 472 | teamOf | | |
| 474 | rdoc | S | קורא S.ratings → יקבל מסמך דירוגים כפרמטר |
| 475 | baseRating | rdoc | |
| 476 | roundRating | baseRating, rdoc | |
| 477 | rv | | |
| 488 | score | | |
| 493 | other | | |
| 495 | teamStats | score | |
| 499 | h2h | score | |
| 500 | standings | h2h, teamStats | |
| 506 | playerStats | | |
| 559 | OVRC | | מטמון גלובלי משתנה. המפתח הוא שחקן+תפקיד בלי ליגה ובלי מצב מנהל → יוסר מהגרסה החדשה |
| 878 | isGoal | | |
| 928 | initialLineup | | |
| 930 | teamStrength | roundRating, rv | |
| 932 | rateMatch | initialLineup, matchGks, other, score, teamStrength | |
| 960 | OVR_K | | קבוע |
| 965 | dD | | |
| 967 | playsOf | initialLineup | |
| 969 | matchWindow | | משתמש בזמני אירועים, לא ב-Date.now |
| 970 | onIntervals | initialLineup, matchWindow | |
| 973 | roundRaw | OVRC, isGoal, matchGks, matchWindow, onIntervals, playsOf, score, standings, teamOf | מטמון |
| 988 | roundAttrs | roundRaw | |
| 989 | roundAwards | OVRC, gkSort, playerStats, roundScores, standings, team | מטמון |
| 995 | manualAttr | rdoc | |
| 1001 | STAR_OVR | | קבוע |
| 1002 | OVR_MIN, OVR_MAX | | קבועים (83, 99) |
| 1004 | pCards | | |
| 1005 | starBase | STAR_OVR, baseRating, rv | |
| 1009 | teamDay | OVRC, score, standings | מטמון |
| 1014 | playerOVR | ... 15 סמלים | **קורא S.admin** → פרמטר מפורש `isAdmin`. מחזיר בתוך hist את אובייקט המחזור כולו → בגרסה החדשה רק roundId |
| 1084 | gkSeconds | | |
| 1087 | matchGks | gkSeconds | |
| 1090 | ratingAgg | matchGks | קורא m.ratings השמורים |
| 1115 | gkSort | | |
| 1116 | roundScores | ratingAgg, roundRaw, standings, team | |
| 1843 | gkCounts | matchGks, team | |
| 1844 | autoGk | gkCounts, team | |

אין שימוש ב-Date.now, ב-Math.random או באחסון בתוך הסגירה. הנגיעות היחידות במצב גלובלי: S.rounds, S.ratings, S.admin ו-OVRC.

הערות:
- הקבועים GF, GKS, LP, TD שמופיעים ב-CLAUDE.md הם משתנים מקומיים בתוך הפונקציות, לא קבועים גלובליים. אעדכן את CLAUDE.md.
- STR_GAP (שורה 931) מוגדר אבל לא בשימוש.
- roundOffset בליגה (מחזורים 1-5 שלפני האפליקציה) לא משפיע על הציונים, רק על המספור.

## 3. קבצי golden

`scripts/extract-golden` (Node, בלי תלויות מלבד מפענח JS):
1. שולף מה-HTML את 42 ההגדרות **כטקסט, בלי שינוי**, ומריץ אותן בארגז חול (vm) עם S מדומה. אב-הטיפוס עצמו לא נוגע.
2. טוען את docs/prototype/data לתוך S.
3. כותב ל-packages/scoring/golden:
   - `rateMatch/<roundId>.json` – ציון וגם פירוק (parts) לכל שחקן בכל משחק
   - `roundScores/<roundId>.json` – field ו-gk
   - `teamDay/<roundId>.json`
   - `gk/<roundId>.json` – gkCounts ו-autoGk לכל קבוצה
   - `playerOVR/<leagueId>.json` – לכל שחקן, f ו-g, פעם כמנהל ופעם כלא-מנהל
   - `stored-vs-current.json` – דוח הפערים מהסעיף למעלה
4. ריצה שנייה צריכה לייצר קבצים זהים לגמרי (בדיקת דטרמיניזם).

## 4. מקרי קצה סינתטיים

מחזורים בנויים ביד, כל אחד בקובץ נפרד, עם golden שמופק באותה דרך:
0-0, תיקו על MVP, שוער מבחוץ (לא בסגל הקבוצה), שוער פחות מדקה, נוקאאוט בפנדלים, מחזור צמוד (tight), מחזור מבוטל.
אוסיף שלושה שראיתי בקוד: ניצחון מהיר (פחות מ-2 ו-5 דקות), גול ניצחון בדקה האחרונה, קבוצה נמוכה בטבלה שמנצחת.

## 5. ההעברה ל-TypeScript

- פונקציה טהורה לכל אחת, קלט מפורש: `playerOVR({ league, rounds, ratings, pid, role, isAdmin })`.
- בלי מטמון גלובלי. אם צריך ביצועים, memo מקומי בתוך קריאה אחת.
- הטקסטים העבריים בפירוק הציון (parts) יהפכו למפתח + פרמטרים (`{ key: 'gk.conceded', n: 2 }`), לטובת i18n. הבדיקה תשווה ערכים, והתרגום ייבדק בנפרד.
- קובץ בדיקה לכל פונקציה שמשווה מול golden.

## 6. מה הציונים צריכים מהנתונים (לשלב 1א)

יפורט בקובץ נפרד. עיקרי הדברים:
- משחק: home, away, n (סדר), status, dur, startedAt, endedAt, timer.acc, lu (on, gk), gk0.
- אירועים: type (goal, own, save, pen, key, shot, def, card, sub, gk), team, p, a, gka, res, min, at (זמן מכשיר).
- מחזור: teams עם players, status, voided, manualOrder, koRank, gkOrder, nextPair, nextGk.
- ליגה: players עם cards; מסמך דירוגים: r (כוכבים), rounds (עקיפה למחזור), attr (ידני). **סודי, רק למנהל.**
- ציוני משחק שמורים (m.ratings) – להחליט אם שומרים או מחשבים (ראה הממצא למעלה).

## איך זה ירוץ

אני בונה ומריץ הכל בסביבת העבודה שלי בענן, ומעתיק את הקבצים לתיקייה chutbol-kit אצלך. לא צריך להתקין כלום כרגע.
כדי להריץ את הבדיקות בעצמך (או ב-Claude Code): Node LTS, pnpm ו-Git, ואז `pnpm install` ו-`pnpm test`.
Git: את `git init` והשמירה הראשונה תריץ אצלך (פקודה אחת), כי אין לי כאן גישה לטרמינל במחשב שלך.

**איך תדע שזה עבד:** `pnpm golden` מייצר את הקבצים פעמיים זהה, ודוח הפערים מציג את 53 ההבדלים שתוארו כאן.

אחרי אישור: שלבים 1 עד 3 בלבד, ואז עצירה לבדיקה שלך.
