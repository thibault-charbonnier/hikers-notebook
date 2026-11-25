/**
 * A search that forgives mistakes, for the names of summits, massifs, trails...
 *
 * How it works, in short:
 *
 * - names and what is typed are first made comparable: lower case, no accents,
 *   hyphens and apostrophes read as spaces ("Dent de Crolles" = "dent  de crolles");
 * - what is typed is cut into words. Every word must be found in the name, as
 *   a whole word, the start of a word, a piece of a word, or a word that
 *   differs by a few letters (one letter wrong for a word of 4-5 letters, two for
 *   longer ones: "chamechod" finds "Chamechaude");
 * - the better the match, the higher the score; ``highlight`` then tells which
 *   letters of the name matched, so they can be written in bold while the
 *   mistaken part stays plain.
 *
 * No library: the lists are small enough (60 000 names) for plain loops.
 */

/** A name made comparable, with, for each of its letters, where it was in the original. */
export interface Normalized {
  text: string;
  /** ``origin[i]`` is the index in the original text of the letter ``text[i]``. */
  origin: number[];
}

/**
 * Make a text comparable.
 *
 * Parameters
 * ----------
 * original : str
 *     Any text.
 *
 * Returns
 * -------
 * Normalized
 *     Lower case, without accents, with everything that is not a letter or a
 *     digit turned into a single space.
 */
export function normalize(original: string): Normalized {
  let text = "";
  const origin: number[] = [];
  for (let i = 0; i < original.length; i++) {
    let letters = original[i].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (letters === "œ") letters = "oe";
    else if (letters === "æ") letters = "ae";
    else if (!/^[a-z0-9]+$/.test(letters)) letters = " ";
    for (const letter of letters) {
      if (letter === " " && (text === "" || text.endsWith(" "))) continue;
      text += letter;
      origin.push(i);
    }
  }
  return { text: text.trimEnd(), origin };
}

/** How many wrong letters a typed word of this length may have. */
function allowedMistakes(length: number): number {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  return 2;
}

/** The letters a-z of a word, as bits (a quick way to rule out words that cannot match). */
function letterMask(word: string): number {
  let mask = 0;
  for (let i = 0; i < word.length; i++) {
    const code = word.charCodeAt(i) - 97;
    if (code >= 0 && code < 26) mask |= 1 << code;
  }
  return mask;
}

const bitCount = (mask: number): number => {
  let count = 0;
  while (mask) {
    mask &= mask - 1;
    count++;
  }
  return count;
};

/**
 * Number of edits (a letter changed, added, removed, or two letters swapped)
 * between two words (Damerau-Levenshtein, restricted).
 */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let previousPrevious: number[] = [];
  let previous = Array.from({ length: cols }, (_, j) => j);
  for (let i = 1; i < rows; i++) {
    const current = [i];
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, previousPrevious[j - 2] + 1);
      }
      current.push(value);
    }
    previousPrevious = previous;
    previous = current;
  }
  return previous[cols - 1];
}

/** A searchable name: its words, ready to be compared with what is typed. */
export interface Searchable {
  norm: Normalized;
  words: string[];
  masks: number[];
}

/** Prepare a name (or any text, plus extra words such as "gr20") for searching. */
export function prepare(original: string, extraWords: string[] = []): Searchable {
  const norm = normalize(original);
  const words = [...(norm.text ? norm.text.split(" ") : []), ...extraWords];
  return { norm, words, masks: words.map(letterMask) };
}

/** How well one typed word matches one word of a name: 0 = no match, higher is better. */
function wordScore(typed: string, typedMask: number, word: string, wordMask: number): number {
  if (word === typed) return 10;
  if (word.startsWith(typed)) return 8 - Math.min(2, (word.length - typed.length) / 8);
  if (typed.length >= 3 && word.includes(typed)) return 5;
  // A number is not forgiven: "GR 20" is not "GR 10".
  const allowed = /\d/.test(typed) ? 0 : allowedMistakes(typed.length);
  if (allowed === 0 || word.length < typed.length - allowed) return 0;
  // Letters of the typed word the name does not have at all: each one costs at least a mistake.
  if (bitCount(typedMask & ~wordMask) > allowed) return 0;
  const whole = word.length <= typed.length + allowed ? editDistance(typed, word) : Infinity;
  // While typing, the end of the word is not typed yet: compare with the start of the word too.
  const start = word.length > typed.length ? editDistance(typed, word.slice(0, typed.length)) : Infinity;
  const distance = Math.min(whole, start);
  return distance <= allowed ? 6 - 1.5 * distance : 0;
}

/**
 * Score a name for what was typed.
 *
 * Parameters
 * ----------
 * typed : list of (str, int)
 *     The typed words (normalized) with their letter masks.
 * target : Searchable
 *     The name.
 *
 * Returns
 * -------
 * float
 *     0 if some typed word is not found in the name, otherwise a score (higher is better).
 */
export function score(typed: { word: string; mask: number }[], target: Searchable): number {
  let total = 0;
  for (const { word, mask } of typed) {
    let best = 0;
    for (let i = 0; i < target.words.length; i++) {
      const value = wordScore(word, mask, target.words[i], target.masks[i]);
      if (value > best) best = value;
    }
    if (best === 0) return 0;
    total += best;
  }
  let result = (total / typed.length) * 10;
  const joined = typed.map((t) => t.word).join(" ");
  if (target.norm.text === joined) result += 60;
  else if (target.norm.text.startsWith(joined)) result += 30;
  return result;
}

/** Cut what the person typed into words, ready for ``score``. */
export function parseQuery(query: string): { word: string; mask: number }[] {
  const text = normalize(query).text;
  return text ? text.split(" ").map((word) => ({ word, mask: letterMask(word) })) : [];
}

/**
 * Which letters of the name matched what was typed.
 *
 * Parameters
 * ----------
 * original : str
 *     The name as shown.
 * target : Searchable
 *     The same name, prepared.
 * typed : list
 *     The typed words, as from ``parseQuery``.
 *
 * Returns
 * -------
 * list of {text, bold}
 *     The name in pieces; the pieces that matched are ``bold``. Letters of a
 *     typed word that are wrong stay plain.
 */
export function highlight(original: string, target: Searchable, typed: { word: string; mask: number }[]): { text: string; bold: boolean }[] {
  const flags = new Array<boolean>(target.norm.text.length).fill(false);
  const text = target.norm.text;
  let offset = 0;
  const places = text.split(" ").map((word) => {
    const place = { word, start: offset };
    offset += word.length + 1;
    return place;
  });
  for (const { word: typedWord } of typed) {
    // The word of the name that matches best.
    let best: { word: string; start: number } | null = null;
    let bestValue = 0;
    for (const place of places) {
      const value = wordScore(typedWord, letterMask(typedWord), place.word, letterMask(place.word));
      if (value > bestValue) {
        bestValue = value;
        best = place;
      }
    }
    if (!best) continue;
    const inside = best.word.indexOf(typedWord);
    if (inside >= 0) {
      for (let i = 0; i < typedWord.length; i++) flags[best.start + inside + i] = true;
    } else {
      // A mistake somewhere: mark the letters the two words have in common, in order.
      for (const index of commonLetters(typedWord, best.word)) flags[best.start + index] = true;
    }
  }

  // Back to the original text: a letter is bold when its normalized letter is.
  const bold = new Array<boolean>(original.length).fill(false);
  target.norm.origin.forEach((index, i) => {
    if (flags[i]) bold[index] = true;
  });
  const pieces: { text: string; bold: boolean }[] = [];
  for (let i = 0; i < original.length; i++) {
    const last = pieces[pieces.length - 1];
    if (last && last.bold === bold[i]) last.text += original[i];
    else pieces.push({ text: original[i], bold: bold[i] });
  }
  return pieces;
}

/** Positions in ``word`` of the letters it shares, in order, with ``typed`` (longest common subsequence). */
function commonLetters(typed: string, word: string): number[] {
  const rows = typed.length + 1;
  const cols = word.length + 1;
  const table = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      table[i][j] = typed[i - 1] === word[j - 1] ? table[i - 1][j - 1] + 1 : Math.max(table[i - 1][j], table[i][j - 1]);
    }
  }
  const found: number[] = [];
  let i = typed.length;
  let j = word.length;
  while (i > 0 && j > 0) {
    if (typed[i - 1] === word[j - 1]) {
      found.push(j - 1);
      i--;
      j--;
    } else if (table[i - 1][j] >= table[i][j - 1]) i--;
    else j--;
  }
  return found.reverse();
}
