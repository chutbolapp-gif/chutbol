# Chutbol – התחלה ב-Claude Code

## לפני הכל (פעם אחת)
1. התיקייה chutbol-kit היא תיקיית הפרויקט. אל תזיז אותה אחרי שמתחילים.
2. ודא שמותקנים במחשב: Node.js (גרסת LTS), Git, ו-pnpm (`npm i -g pnpm`).
3. פתח את אפליקציית Claude למחשב ← Claude Code ← בחר את התיקייה chutbol-kit.
4. מה שלא צריך עכשיו: חשבון Expo, Apple Developer, ספק SMS. הם נכנסים בשלבים מאוחרים יותר (ראה "סדר העבודה").

## למה מתחילים מהציונים ולא מהאפליקציה
חבילת הציונים היא הסיכון הכי גדול בפרויקט, היא לא צריכה שום חשבון, ומבנה הנתונים צריך לנבוע ממה שהציונים צריכים.
מעבר לזה, יש רק ערב אמיתי אחד ששוחק (מחזור 6), ולכן קודם מפיקים "תשובות נכונות" מאב-הטיפוס עצמו ורק אז מעבירים את הקוד.

## ההודעה הראשונה ל-Claude Code (העתק והדבק)

```
Read CLAUDE.md and docs/spec.md, then look at docs/prototype/soccerfriends.html and docs/prototype/data.

We are starting stage 0a: the scoring package. Do NOT write code yet. First give me a plan, in simple Hebrew, that covers:

1. Repo setup: git init, pnpm workspace monorepo with packages/shared (types) and packages/scoring (Vitest). apps/mobile and supabase come later; only reserve the folders.
2. Dependency map: find rateMatch, roundScores, playerOVR, teamDay, gkCounts and autoGk in the prototype and list every function and constant they depend on, recursively. Show the list with line numbers and flag anything that touches globals, UI state (S.admin), Date.now() or storage.
3. Golden files: a Node script (scripts/extract-golden) that loads the prototype's original functions unchanged (extract them from the HTML, run them in a sandbox with stubbed globals) on docs/prototype/data and writes the expected outputs to packages/scoring/golden: per-match ratings, roundScores, teamDay, gkCounts/autoGk, and playerOVR for every player and role. Also check the generated per-match ratings against the ratings already stored in the round files, and report any mismatch to me before going further.
4. Synthetic edge-case fixtures, as listed in CLAUDE.md, with their golden outputs produced the same way.
5. The port: TypeScript pure functions with explicit inputs, the types in packages/shared, and one test file per function that compares against the golden files.
6. What the scoring needs from the data (events, lineups, GK minutes, etc.), written as a short note I can use for stage 1a.

Tell me what I need to install, the commands you will run, and how I will know it worked. After I approve, start with steps 1 to 3 only and stop for my review.
```

## סדר העבודה
| שלב | מה | שער מעבר |
| --- | --- | --- |
| 0א | monorepo + packages/scoring + קבצי תשובות נכונות | כל בדיקות ה-golden עוברות |
| 0ב | אפליקציית Expo, ניווט, RTL, כניסה בטלפון עם מספרי בדיקה של Supabase | נכנסים מהטלפון שלך דרך Expo Go |
| 1א | טבלאות, RLS (כולל טבלאות סודיות נפרדות), סקריפט ייבוא | בדיקות RLS עוברות, והטבלה השנתית אחרי ייבוא זהה לאב-הטיפוס |
| 1ב | סגל, עדיפות, הגעה והמתנה, תשלומים (קישור Paybox), התראות, קבוצות | ערב מתוכנן מקצה לקצה |
| 1ג | משחק חי. כאן עוברים לגרסת פיתוח של EAS (צריך חשבון Expo, ובאייפון Apple Developer) | ערב שלם בלי קליטה, בלי תקלות |

## הרגלי עבודה
- משימה אחת בכל שיחה. בתחילת כל שיחה: "קרא את CLAUDE.md" והפניה לפרק המתאים באפיון.
- כל ערב שמשחקים מעכשיו: לייצא מאב-הטיפוס ל-docs/prototype/data ולהריץ שוב את scripts/extract-golden. כל ערב כזה מחזק את הבדיקות.
- שמירה ב-Git אחרי כל שלב שעובד.
- טלפונים ותמונות: לפני שלב 1א צריך ייצוא נפרד מאב-הטיפוס (הטלפונים שמורים רק בדפדפן של המנהל). הקובץ הזה לא נכנס ל-Git.
