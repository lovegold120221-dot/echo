/**
 * TTS Input Text Enhancer
 *
 * Follows production-grade TTS best practices:
 * - Character normalization (written → spoken symbols)
 * - Number/currency/phone/date normalization for natural speech
 * - Abbreviation expansion
 * - Supports <break time="x.xs" /> and [audio tags] pass-through for Echo v3
 */

// --- Number-to-words (cardinal, 0–999999) for currency and numbers ---
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const TEENS = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];

function numberToWords(n: number): string {
  if (n === 0) return "zero";
  if (n < 0 || !Number.isInteger(n) || n > 999999) return String(n);

  const parts: string[] = [];

  if (n >= 1000) {
    const thousands = Math.floor(n / 1000);
    parts.push(thousands === 1 ? "one thousand" : numberToWords(thousands) + " thousand");
    n %= 1000;
    if (n === 0) return parts.join(" ");
  }

  if (n >= 100) {
    parts.push(ONES[Math.floor(n / 100)] + " hundred");
    n %= 100;
  }

  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)]);
    n %= 10;
    if (n > 0) parts.push(ONES[n]);
  } else if (n >= 10) {
    parts.push(TEENS[n - 10]);
  } else if (n > 0) {
    parts.push(ONES[n]);
  }

  return parts.join(" ");
}

/** Spell each digit as a word (for phone numbers, codes) */
function spellOutDigits(s: string): string {
  return s.replace(/\d/g, (d) => ONES[parseInt(d, 10)] + " ").trim();
}

/** Normalize a single character to spoken form */
function spokenChar(ch: string): string {
  switch (ch) {
    case "@": return " at ";
    case ".": return " dot ";
    case "-": return " dash ";
    case "/": return " slash ";
    case "_": return " underscore ";
    case "#": return " number ";
    case "*": return " asterisk ";
    default: return ch;
  }
}

/** Common ordinals */
const ORDINALS: Record<string, string> = {
  "1st": "first", "2nd": "second", "3rd": "third", "4th": "fourth", "5th": "fifth",
  "6th": "sixth", "7th": "seventh", "8th": "eighth", "9th": "ninth", "10th": "tenth",
  "11th": "eleventh", "12th": "twelfth", "13th": "thirteenth", "20th": "twentieth",
  "21st": "twenty-first", "22nd": "twenty-second", "23rd": "twenty-third",
};

/**
 * Full normalization for TTS (Echo best practices):
 * - Phone numbers → spoken digits with commas
 * - Currency ($, £, €, ¥) → words
 * - Percent → "X percent"
 * - Ordinals (1st, 2nd…) → first, second…
 * - Decimals (3.14) → three point one four
 * - Abbreviations (Dr., Ave., St. [when street]) → expanded
 * - Shortcuts (Ctrl + Z) → control z
 * - Then character normalization (@, ., /, etc.)
 */
export function normalizeForTTS(text: string): string {
  if (!text || typeof text !== "string") return text;

  let t = text;

  // Phone numbers: 555-555-5555 or (555) 555-5555 → five five five, five five five, five five five five
  t = t.replace(/(?:^|\s)\(?(\d{3})\)?[-.\s]*(\d{3})[-.\s]*(\d{4})(?:\s|$|[.,;])/g, (_, a, b, c) =>
    ` ${spellOutDigits(a)}, ${spellOutDigits(b)}, ${spellOutDigits(c)} `
  );

  // Currency: $1,234.56 or $42.50
  t = t.replace(/([$£€¥])\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g, (_, sym, num) => {
    const clean = num.replace(/,/g, "");
    const currency: Record<string, string> = { $: "dollars", "£": "pounds", "€": "euros", "¥": "yen" };
    const name = currency[sym] || "currency";
    if (clean.includes(".")) {
      const [d, c] = clean.split(".");
      const dNum = parseInt(d, 10);
      const cNum = parseInt(c, 10);
      if (cNum === 0) return ` ${numberToWords(dNum)} ${name} `;
      return ` ${numberToWords(dNum)} ${name} and ${numberToWords(cNum)} cents `;
    }
    return ` ${numberToWords(parseInt(clean, 10))} ${name} `;
  });

  // Percent: 42% or 100%
  t = t.replace(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*%/g, (_, num) => {
    const n = parseInt(num.replace(/,/g, ""), 10);
    return ` ${numberToWords(n)} percent `;
  });

  // Ordinals: 1st, 2nd, 3rd, 4th... (word boundary)
  Object.entries(ORDINALS).forEach(([key, value]) => {
    t = t.replace(new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), value);
  });

  // Decimals (standalone numbers with one dot): 3.14 → three point one four
  t = t.replace(/\b(\d+)\.(\d+)\b/g, (_, a, b) => {
    const aNum = parseInt(a, 10);
    const bStr = b.split("").map((d: string) => ONES[parseInt(d, 10)]).join(" ");
    return ` ${numberToWords(aNum)} point ${bStr} `;
  });

  // Abbreviations (word boundary, then .)
  t = t.replace(/\bDr\./gi, " Doctor ");
  t = t.replace(/\bAve\./gi, " Avenue ");
  // St. → Street only when likely an address (followed by comma, lowercase, or end of string)
  t = t.replace(/\bSt\.(?=\s*[,]|\s+[a-z]|\s*$)/gi, " Street ");

  // Shortcuts: Ctrl + Z → control z, Cmd + S → command s
  t = t.replace(/\bCtrl\s*\+\s*([A-Za-z])/gi, (_, key) => ` control ${key.toLowerCase()} `);
  t = t.replace(/\bCmd\s*\+\s*([A-Za-z])/gi, (_, key) => ` command ${key.toLowerCase()} `);
  t = t.replace(/\bAlt\s*\+\s*([A-Za-z0-9])/gi, (_, key) => ` alt ${key.toLowerCase()} `);

  // Units: 100km → one hundred kilometers
  t = t.replace(/\b(\d+(?:,\d{3})*(?:\.\d+)?)\s*km\b/gi, (_, num) => {
    const n = parseInt(num.replace(/,/g, ""), 10);
    return ` ${numberToWords(n)} kilometers `;
  });

  t = t.replace(/\s+/g, " ").trim();

  // Character normalization: @ . / - _ # * (emails, URLs, codes)
  let out = "";
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === ".") {
      const prev = i > 0 && /\w/.test(t[i - 1]);
      const next = i + 1 < t.length && /\w/.test(t[i + 1]);
      out += prev && next ? " dot " : c;
    } else if (c === "@") {
      out += " at ";
    } else if (/[-/#*_]/.test(c)) {
      const prev = i > 0 && /[a-zA-Z0-9]/.test(t[i - 1]);
      const next = i + 1 < t.length && /[a-zA-Z0-9]/.test(t[i + 1]);
      out += prev || next ? spokenChar(c) : c;
    } else {
      out += c;
    }
  }

  return out.replace(/\s+/g, " ").trim();
}

/**
 * Lightweight enhance: symbols only (emails, URLs, codes).
 * Use when you don't want numbers/currency expanded.
 */
export function enhanceTextForTTS(text: string): string {
  if (!text || typeof text !== "string") return text;

  let out = "";
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const c = text[i];

    if (c === ".") {
      const prevWord = i > 0 && /\w/.test(text[i - 1]);
      const nextWord = i + 1 < len && /\w/.test(text[i + 1]);
      out += prevWord && nextWord ? " dot " : spokenChar(c);
    } else if (c === "@") {
      out += " at ";
    } else if (/[-/#*_]/.test(c)) {
      const prevAlnum = i > 0 && /[a-zA-Z0-9]/.test(text[i - 1]);
      const nextAlnum = i + 1 < len && /[a-zA-Z0-9]/.test(text[i + 1]);
      out += prevAlnum || nextAlnum ? spokenChar(c) : c;
    } else {
      out += c;
    }
  }

  return out.replace(/\s+/g, " ").trim();
}

/**
 * Apply concise phrasing (optional): contract common phrases for more natural TTS.
 */
export function concisePhrasing(text: string): string {
  if (!text || typeof text !== "string") return text;
  return text
    .replace(/\byou're going to\b/gi, "you'll")
    .replace(/\bwe are going to\b/gi, "we'll")
    .replace(/\bI am going to\b/gi, "I'll")
    .replace(/\bdo not\b/gi, "don't")
    .replace(/\bcan not\b/gi, "can't")
    .replace(/\bwill not\b/gi, "won't")
    .replace(/\bit is\b/gi, "it's")
    .replace(/\bthat is\b/gi, "that's")
    .replace(/\bthere is\b/gi, "there's")
    .replace(/\s+/g, " ")
    .trim();
}

