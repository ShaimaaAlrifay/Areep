/* ============================================================
   Kashida (tatweel, U+0640) — elongating a word for emphasis.

   This is the Arabic typographic device for weighting a word inside a
   headline: the connecting stroke between two letters is stretched, so
   the word gains presence without changing its size, colour or weight.

   It has one hard rule, and breaking it is what makes kashida look
   amateurish rather than typeset: **a tatweel may only follow a letter
   that connects forwards.** Six letters never do —
   ا د ذ ر ز و (and their variants) — so a tatweel placed after any of
   them detaches into a floating dash instead of stretching anything.
   That is exactly the mistake this module exists to prevent: the
   position is found by the code, not chosen by hand in a string.

   Diacritics are treated as part of the letter before them, so a tatweel
   is never wedged between a letter and its own shadda.

   Deliberately scoped: this is for display headings only, a couple of
   words in the whole site. Two costs come with real tatweel characters —
   find-in-page will not match the plain spelling, and neither will a
   copy-paste — which is acceptable for a headline nobody searches inside,
   and would not be for body copy. The <title>, the meta description and
   every heading not passed through here keep their plain spelling.
   ============================================================ */

/** Letters with no forward-joining form: nothing may attach after them. */
const NO_FORWARD_JOIN = new Set([
  'ا', 'أ', 'إ', 'آ', 'ٱ',
  'د', 'ذ',
  'ر', 'ز', 'ژ',
  'و', 'ؤ',
  'ة', 'ى', 'ء',
])

/** Combining marks — part of the letter they sit on, never a join point. */
const DIACRITIC = /[ً-ْٰـ]/

const TATWEEL = 'ـ'

/**
 * Returns `word` with a run of tatweels inserted at a valid join, or the
 * word untouched when it has none (a word like "دار" cannot be elongated
 * at all — every letter in it is a non-joiner).
 *
 * The join nearest the middle of the word is chosen, because elongating
 * at the very start or end reads as a mistake rather than as emphasis.
 *
 * @param {string} word
 * @param {number} count how many tatweels; 3 is the usual display amount
 */
export function kashida(word, count = 3) {
  if (typeof word !== 'string' || !word) return word

  // Group each base letter with any diacritics that follow it.
  const units = []
  for (const char of word) {
    if (units.length && DIACRITIC.test(char)) units[units.length - 1] += char
    else units.push(char)
  }

  // A join exists after unit i when that unit's base letter connects
  // forwards and something follows it.
  const joins = []
  for (let i = 0; i < units.length - 1; i += 1) {
    if (!NO_FORWARD_JOIN.has(units[i][0])) joins.push(i)
  }
  if (joins.length === 0) return word

  const middle = (units.length - 1) / 2
  const at = joins.reduce((best, i) => (Math.abs(i - middle) < Math.abs(best - middle) ? i : best), joins[0])

  units[at] += TATWEEL.repeat(Math.max(1, count))
  return units.join('')
}
