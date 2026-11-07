/**
 * Crisis detection is intentionally NOT delegated to the LLM. A fixed,
 * reviewed keyword/phrase check runs first and, when triggered, the fixed
 * resource message below is what gets shown — the model is not trusted to
 * author crisis-resource text on the fly. This is a blunt instrument by
 * design: false positives (an over-cautious trigger) are an acceptable cost
 * for a safety layer; false negatives are not.
 *
 * This list is a starting point, not a complete clinical instrument, and
 * should be reviewed by someone with relevant expertise before production
 * use — see docs/ROADMAP.md.
 */
const CRISIS_PATTERNS: RegExp[] = [
  /\bsuicid(e|al)\b/i,
  /\bkill myself\b/i,
  /\bend my life\b/i,
  /\bwant to die\b/i,
  /\bhurt(ing)? myself\b/i,
  /\bself[- ]harm\b/i,
  /\bno reason to live\b/i,
  /\bcan'?t go on\b/i
];

export function detectCrisisLanguage(message: string): boolean {
  return CRISIS_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Deliberately not AI-generated. Keep this in sync with a reviewed,
 * jurisdiction-aware resource list before production use — the specific
 * numbers below are US-centric placeholders.
 */
export const CRISIS_RESPONSE = `I'm really glad you reached out, and I want to take what you said seriously.

I'm not able to provide crisis support, and I don't want to guess at what would help most right now. If you're in immediate danger, please contact your local emergency services.

If you're in the US, you can call or text 988 (the Suicide & Crisis Lifeline) any time. Wherever you are, a trusted person — a friend, family member, or doctor — reaching out with you can help.

SignalWell AI provides wellbeing insights and educational guidance. It does not provide medical diagnosis or emergency mental health care.`;
