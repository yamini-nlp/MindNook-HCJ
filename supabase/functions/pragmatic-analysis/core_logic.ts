export const ACTIONS = ["affirm", "encourage", "reflect", "support", "intervene"];
export const ACTION_TARGET: Record<string, number> = { affirm: 1, encourage: 0.5, reflect: 0, support: -0.5, intervene: -1 };
export const PRIVACY_DEPTH: Record<string, number> = { affirm: 0, encourage: 0, reflect: 1, support: 2, intervene: 3 };
export const AUTONOMY_WEIGHT: Record<string, number> = { affirm: 0, encourage: 0.1, reflect: 0.2, support: 0.5, intervene: 1 };

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export interface L1 { sentiment: string; positiveWordCount: number; negativeWordCount: number; }
export interface L2 { dominant: string; distribution: Record<string, number>; }
export interface L3 { direction: string; label: string; slope: number; }
export interface L4 { score: number | null; label: string; }

export function computeAppropriateness(action: string, l1: L1, l2: L2, l3: L3, l4: L4): number {
  const sentimentScore = l1.sentiment === "Positive" ? 1 : l1.sentiment === "Negative" ? -1 : 0;
  const trendScore = l3.direction === "up" ? 1 : l3.direction === "down" ? -1 : 0;
  const goalScore = l4.score != null ? (l4.score - 50) / 50 : 0;
  const pragScore = l2.dominant === "help-seeking" ? 1 : l2.dominant === "question" ? 0.5 : 0;
  const compositeSignal = clamp(sentimentScore * 0.4 + trendScore * 0.3 + goalScore * 0.2 + pragScore * 0.1, -1, 1);
  const target = ACTION_TARGET[action] ?? 0;
  return +clamp(1 - Math.abs(compositeSignal - target) / 2, 0, 1).toFixed(3);
}

export function computeSafety(action: string, l1: L1, l3: L3, entryHistory: number[]): number {
  const recentLow = entryHistory.length >= 3 && entryHistory.slice(-3).every((s) => s < 35);
  const concerning = (l3.direction === "down" && l1.sentiment === "Negative") || recentLow;
  const gentleActions = ["support", "intervene"];
  const safety = concerning ? (gentleActions.includes(action) ? 1 : -1) : (action === "intervene" ? -0.3 : 0.2);
  return +clamp(safety, -1, 1).toFixed(3);
}

export function computePrivacyCost(action: string, inferenceDepth: number): number {
  const base = PRIVACY_DEPTH[action] ?? 1;
  return +clamp((base + inferenceDepth) / 4, 0, 1).toFixed(3);
}

export function computeAutonomyCost(action: string, userAutonomyPreference: number): number {
  const weight = AUTONOMY_WEIGHT[action] ?? 0.2;
  return +clamp(weight * userAutonomyPreference, 0, 1).toFixed(3);
}

export interface UtilityWeights { w_task: number; w_safety: number; lambda_privacy: number; lambda_autonomy: number; }

export const SUPERLATIVE_MARKERS = [
  "worst", "best", "always", "never", "completely", "totally", "literally",
  "absolutely", "entirely", "forever", "impossible", "everyone", "everything",
  "nothing", "nobody", "no one", "ruined", "destroyed", "perfect", "disaster",
  "hopeless", "unbearable", "catastrophe", "catastrophic"
];

export const HYPERBOLE_THRESHOLD = 0.55;

export interface HyperboleScore { score: number; markers: string[]; markerCount: number; exclamationDensity: number; conclusionOriented: boolean; }

export function escapeRegex(str: string): string {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}

export function computeExclamationDensity(text: string): number {
  const sentenceCount = Math.max(1, (text.match(/[.!?]+/g) || []).length);
  const exclCount = (text.match(/!/g) || []).length;
  return +(exclCount / sentenceCount).toFixed(3);
}

export function computeConclusionOriented(text: string): boolean {
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  if (!sentences.length) return false;
  const avgLen = sentences.reduce((a, s) => a + s.split(/\s+/).length, 0) / sentences.length;
  const shortDeclarative = sentences.filter((s) => s.split(/\s+/).length <= 8 && !/[,;:]/.test(s)).length;
  return (shortDeclarative / sentences.length) >= 0.5 && avgLen <= 10;
}

export function scoreHyperbole(text: string): HyperboleScore {
  if (!text || typeof text !== "string" || !text.trim()) {
    return { score: 0, markers: [], markerCount: 0, exclamationDensity: 0, conclusionOriented: false };
  }
  const textLower = text.toLowerCase();
  const hits: string[] = [];
  SUPERLATIVE_MARKERS.forEach((m) => {
    const re = new RegExp("\\b" + escapeRegex(m) + "\\b", "g");
    const matches = textLower.match(re);
    if (matches) hits.push(...matches.map(() => m));
  });
  const wordCount = Math.max(1, text.trim().split(/\s+/).length);
  const markerDensity = Math.min(1, hits.length / Math.max(4, wordCount / 6));
  const exclamationDensity = computeExclamationDensity(text);
  const conclusionOriented = computeConclusionOriented(text);
  const score = Math.max(0, Math.min(1, markerDensity * 0.55 + Math.min(1, exclamationDensity) * 0.25 + (conclusionOriented ? 0.2 : 0)));
  return { score: +score.toFixed(3), markers: [...new Set(hits)], markerCount: hits.length, exclamationDensity, conclusionOriented };
}

export function isTraumaProcessingGoal(goalTexts: unknown): boolean {
  if (!Array.isArray(goalTexts)) return false;
  const markers = ["process difficult memories", "process my memories", "processing memories", "trauma", "therapeutic writing", "process my grief", "processing grief", "process the past"];
  return goalTexts.some((g) => typeof g === "string" && markers.some((m) => g.toLowerCase().includes(m)));
}

export interface ContextCollapseGuardResult {
  collapseDetected: boolean;
  possibleHyperbole: boolean;
  downgradeTo: string | null;
  hyperboleScore: number;
  trendLabel: string;
  strongNegative: boolean;
}

export function contextCollapseGuard(l1: L1, l3: L3, hyperboleScore: HyperboleScore): ContextCollapseGuardResult {
  const score = hyperboleScore?.score ?? 0;
  const negWordCount = l1.negativeWordCount || 0;
  const posWordCount = l1.positiveWordCount || 0;
  const strongNegative = l1.sentiment === "Negative" && negWordCount > posWordCount;
  const trendLabel = l3.label || "insufficient data";
  const trendStableOrInsufficient = trendLabel === "stable" || trendLabel === "insufficient data";
  const trendDeclining = trendLabel === "declining";
  const collapseDetected = !!(strongNegative && trendStableOrInsufficient && !trendDeclining && score >= HYPERBOLE_THRESHOLD);
  return {
    collapseDetected,
    possibleHyperbole: collapseDetected,
    downgradeTo: collapseDetected ? "support" : null,
    hyperboleScore: score,
    trendLabel,
    strongNegative
  };
}

export function computeDecomposedUtility(action: string, l1: L1, l2: L2, l3: L3, l4: L4, entryHistory: number[], inferenceDepth: number, autonomyPreference: number, weights: UtilityWeights) {
  const appropriateness = computeAppropriateness(action, l1, l2, l3, l4);
  const safety = computeSafety(action, l1, l3, entryHistory);
  const privacyCost = computePrivacyCost(action, inferenceDepth);
  const autonomyCost = computeAutonomyCost(action, autonomyPreference);
  const rawUtility = weights.w_task * appropriateness + weights.w_safety * safety
    - weights.lambda_privacy * privacyCost - weights.lambda_autonomy * autonomyCost;
  const utility = +clamp(rawUtility, -1, 1).toFixed(3);
  return { utility, breakdown: { appropriateness, safety, privacyCost, autonomyCost } };
}