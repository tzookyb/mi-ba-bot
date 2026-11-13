/**
 * All user-facing Hebrew text lives here (see AGENTS.md). Use functions, not bare strings,
 * whenever text depends on data, so grammar (gender, plural) is handled in one place.
 */
export const he = {
  start: {
    hello: "שלום! אני מי בא? 👋\nאני עוזר לקבוצות לתאם מפגשים לפי הזמינות של כולם.",
  },
} as const;
