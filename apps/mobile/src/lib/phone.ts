// Phone numbers as Supabase stores them (auth.users.phone): E.164 digits without "+".
// Israeli local numbers (050-1234567) are the common case; international ones (+44...) also work.

/** "050-123 4567", "+972 50 1234567", "00972501234567" -> "972501234567". Null when it is not a phone number. */
export function normalizePhone(input: string): string | null {
  let d = input.trim().replace(/[\s\-().]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '972' + d.slice(1);
  if (!/^\d{8,15}$/.test(d)) return null;
  // Israel: 9 digits after the country code for mobiles (5x), 8 for landlines
  if (d.startsWith('972') && !/^972[2-9]\d{7,8}$/.test(d)) return null;
  return d;
}

/** "972501234567" -> "050-1234567" for display; other countries as "+<digits>". */
export function formatPhone(e164: string): string {
  if (/^9725\d{8}$/.test(e164)) return `0${e164.slice(3, 5)}-${e164.slice(5)}`;
  return `+${e164}`;
}
