import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ScenarioCategory = 'DAILY_LIFE' | 'SOCIAL' | 'TRAVEL_SHOPPING' | 'WORKPLACE';
export type ScenarioStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type ChunkFunctionalTag = 'OPENING' | 'REQUEST' | 'CLARIFY' | 'AGREE_DECLINE' | 'CLOSING';

export interface ScenarioSummary {
  id: string;
  slug: string;
  category: ScenarioCategory;
  titleVi: string;
  titleEn: string;
  level: string;
  estimatedDurationMinutes: number;
  userRole: string;
  aiRole: string;
  goals: string[];
  sortOrder: number;
  status: ScenarioStatus;
  highestScore: number | null;
  xpReward: number;
  chunksCount: number;
}

export interface ScenarioCategorySummary {
  category: string;
  nameVi: string;
  totalCount: number;
  completedCount: number;
}

export interface ScenarioLibraryResponse {
  scenarios: ScenarioSummary[];
  totalCount: number;
  completedCount: number;
  totalProgressPct: number;
  categories: ScenarioCategorySummary[];
  xpReward: number;
}

export interface ScenarioRequirement {
  id: string;
  description: string;
  type: string;
  expectedChunkFunction?: string | null;
  isMandatory: boolean;
  sortOrder: number;
}

export interface ScenarioChunk {
  id: string;
  scenarioId?: string;
  functionTag: ChunkFunctionalTag;
  text: string;
  meaningVi: string;
  audioUrl?: string | null;
  exampleSentence: string;
  acceptedVariations: string[];
  /** Wrong English options for VI→EN MCQ drill phase */
  distractorsEn: string[];
  /** Wrong Vietnamese options for EN→VI MCQ drill phase */
  distractorsVi: string[];
  sortOrder: number;
}

export interface ScenarioDetail {
  id: string;
  slug: string;
  category: ScenarioCategory;
  titleVi: string;
  titleEn: string;
  level: string;
  estimatedDurationMinutes: number;
  context: string;
  userRole: string;
  aiRole: string;
  goals: string[];
  sortOrder: number;
  status: ScenarioStatus;
  highestScore: number | null;
  xpReward: number;
  requirements: ScenarioRequirement[];
  chunks: ScenarioChunk[];
  practicedChunks: string[];
}

export interface ScenarioChunksResponse {
  scenarioId: string;
  scenarioTitle: string;
  chunks: ScenarioChunk[];
}

export interface RecordDrillRequest {
  chunkId: string;
  isSkipped?: boolean;
}

export interface RecordDrillResponse {
  attemptId: string;
  chunkId: string;
  scenarioId: string;
  isSkipped: boolean;
  practicedChunks: string[];
  message: string;
}

export interface RoleplaySessionResponse {
  sessionId: string;
  scenarioId: string;
  status: string;
  openingMessage: string;
  chunks: ScenarioChunk[];
}

export interface RoleplayEndResponse {
  id: string;
  status: string;
  endedAt: string | null;
  durationSeconds: number;
  spokenSeconds: number;
  endReason?: string | null;
}

export interface RequirementEvaluationItem {
  requirementId: string;
  description: string;
  isMandatory: boolean;
  status: 'PASS' | 'FAIL';
  evidence: string | null;
  reason: string;
}

export interface ChunkUsedWellItem {
  chunkId: string;
  text: string;
  functionTag: string;
  matchedUtterance: string;
  matchType: string;
}

export interface ChunkToImproveItem {
  chunkId: string;
  text: string;
  functionTag: string;
  meaningVi: string;
  reason: string;
}

export interface RoleplayEvaluationResponse {
  sessionId: string;
  scenarioId: string;
  scenarioTitle: string;
  status: 'PENDING' | 'FEEDBACK_READY' | 'INSUFFICIENT_DATA' | 'FAILED';
  passed: boolean;
  overallScore: number | null;
  requirements: RequirementEvaluationItem[];
  chunksUsedWell: ChunkUsedWellItem[];
  chunksToImprove: ChunkToImproveItem[];
  strengths: string[];
  improvements: string[];
  nextPractice: string | null;
  evaluatedAt: string | null;
}

export interface ChunkBankItem {
  id: string;
  chunkId: string;
  status: 'NEEDS_PRACTICE' | 'MASTERED';
  lastReviewedAt: string;
  chunkText: string;
  meaningVi: string;
  scenarioTitle: string;
}

export interface ChunkBankResponse {
  items: ChunkBankItem[];
  totalCount: number;
  needsPracticeCount: number;
  masteredCount: number;
}

export interface WordPronunciationScore {
  word: string;
  status: 'correct' | 'imperfect' | 'missing';
}

export interface ChunkEvaluationResult {
  score: number; // 0-100
  words: WordPronunciationScore[];
  isMatch: boolean;
}

const IPA_DICTIONARY: Record<string, string> = {
  "i'm": "aɪm",
  "i": "aɪ",
  "am": "æm",
  "looking": "ˈlʊk.ɪŋ",
  "for": "fɔːr",
  "a": "ə",
  "an": "æn",
  "the": "ðə",
  "where": "wɛər",
  "can": "kæn",
  "find": "faɪnd",
  "could": "kʊd",
  "you": "juː",
  "please": "pliːz",
  "help": "hɛlp",
  "me": "miː",
  "how": "haʊ",
  "much": "mʌtʃ",
  "is": "ɪz",
  "are": "ɑːr",
  "this": "ðɪs",
  "that": "ðæt",
  "these": "ðiːz",
  "those": "ðoʊz",
  "i'd": "aɪd",
  "like": "laɪk",
  "to": "tuː",
  "book": "bʊk",
  "table": "ˈteɪ.bəl",
  "two": "tuː",
  "persons": "ˈpɜː.sənz",
  "people": "ˈpiː.pəl",
  "do": "duː",
  "have": "hæv",
  "any": "ˈɛn.i",
  "recommendations": "ˌrɛk.ə.mɛnˈdeɪ.ʃənz",
  "recommend": "ˌrɛk.əˈmɛnd",
  "bill": "bɪl",
  "check": "tʃɛk",
  "symptoms": "ˈsɪmp.təmz",
  "feel": "fiːl",
  "dizzy": "ˈdɪz.i",
  "headache": "ˈhɛd.eɪk",
  "fever": "ˈfiː.vər",
  "medicine": "ˈmɛd.ɪ.sən",
  "prescription": "prɪˈskrɪp.ʃən",
  "apartment": "əˈpɑːrt.mənt",
  "rent": "rɛnt",
  "month": "mʌnθ",
  "utilities": "juːˈtɪl.ɪ.tiz",
  "included": "ɪnˈkluː.dɪd",
  "deposit": "dɪˈpɒz.ɪt",
  "introduce": "ˌɪn.trəˈdjuːs",
  "myself": "maɪˈsɛlf",
  "name": "neɪm",
  "software": "ˈsɒft.wɛər",
  "engineer": "ˌɛn.dʒɪˈnɪər",
  "from": "frɒm",
  "vietnam": "ˌvjɛtˈnæm",
  "nice": "naɪs",
  "meet": "miːt",
  "party": "ˈpɑːr.ti",
  "drink": "drɪŋk",
  "music": "ˈmjuː.zɪk",
  "online": "ˈɒn.laɪn",
  "profile": "ˈproʊ.faɪl",
  "connect": "kəˈnɛkt",
  "work": "wɜːrk",
  "job": "dʒɒb",
  "meeting": "ˈmiː.tɪŋ",
  "project": "ˈprɒdʒ.ɛkt",
  "deadline": "ˈdɛd.laɪn",
  "update": "ʌpˈdeɪt",
  "presentation": "ˌprɛz.ənˈteɪ.ʃən",
  "good": "ɡʊd",
  "benefit": "ˈbɛn.ɪ.fɪt",
  "packages": "ˈpæk.ɪ.dʒɪz",
  "opportunities": "ˌɒp.ərˈtjuː.nə.tiz",
  "learn": "lɜːrn",
  "new": "njuː",
  "things": "θɪŋz",
  "thank": "θæŋk",
  "thanks": "θæŋks",
  "lot": "lɒt",
  "excuse": "ɪkˈskjuːz",
  "sorry": "ˈsɒr.i",
  "yes": "jɛs",
  "no": "noʊ",
  "sure": "ʃʊər",
  "great": "ɡreɪt",
  "sounds": "saʊndz",
  "perfect": "ˈpɜː.fɪkt",
  "bye": "baɪ",
  "goodbye": "ɡʊdˈbaɪ",
  "see": "siː",
  "later": "ˈleɪ.tər"
};

export function getIpaPhonetic(text: string): string {
  if (!text) return '';
  const clean = text.replace(/[^a-zA-Z0-9'\s]/g, '').toLowerCase();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const ipaWords = words.map((w) => IPA_DICTIONARY[w] || w);
  return `/${ipaWords.join(' ')}/`;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function wordSimilarity(w1: string, w2: string): number {
  if (w1 === w2) return 1.0;
  const maxLen = Math.max(w1.length, w2.length);
  if (maxLen === 0) return 1.0;
  return Math.max(0, 1 - levenshtein(w1, w2) / maxLen);
}

const CONTRACTION_MAP: Record<string, string[]> = {
  "i'm": ["i", "am", "im"],
  "don't": ["do", "not", "dont"],
  "can't": ["can", "not", "cannot", "cant"],
  "won't": ["will", "not", "wont"],
  "it's": ["it", "is", "its"],
  "that's": ["that", "is", "thats"],
  "you're": ["you", "are", "youre"],
  "we're": ["we", "are", "were"],
  "they're": ["they", "are", "theyre"],
  "i've": ["i", "have", "ive"],
  "i'll": ["i", "will", "ill"],
  "i'd": ["i", "would", "i", "had", "id"],
};

export function evaluatePronunciation(targetText: string, spokenText: string): ChunkEvaluationResult {
  if (!targetText) {
    return { score: 0, words: [], isMatch: false };
  }
  const targetWords = targetText.trim().split(/\s+/);
  if (!spokenText || !spokenText.trim()) {
    return {
      score: 0,
      words: targetWords.map((w) => ({ word: w, status: 'missing' })),
      isMatch: false,
    };
  }

  const cleanSpoken = spokenText.toLowerCase().replace(/[^a-z0-9\s']/g, ' ');
  const spokenTokens = cleanSpoken.split(/\s+/).filter(Boolean);
  const usedSpokenIndices = new Set<number>();

  let matchedScore = 0;
  const evaluatedWords: WordPronunciationScore[] = [];

  for (const rawWord of targetWords) {
    const cleanWord = rawWord.toLowerCase().replace(/[^a-z0-9']/g, '');
    if (!cleanWord) {
      evaluatedWords.push({ word: rawWord, status: 'correct' });
      matchedScore += 1;
      continue;
    }

    // 1. Exact match
    let bestMatchIdx = -1;
    for (let i = 0; i < spokenTokens.length; i++) {
      if (!usedSpokenIndices.has(i) && spokenTokens[i] === cleanWord) {
        bestMatchIdx = i;
        break;
      }
    }

    if (bestMatchIdx !== -1) {
      usedSpokenIndices.add(bestMatchIdx);
      evaluatedWords.push({ word: rawWord, status: 'correct' });
      matchedScore += 1.0;
      continue;
    }

    // 2. Contraction match (e.g. "I'm" matching "I am" or "im")
    const contractionEquivalents = CONTRACTION_MAP[cleanWord];
    if (contractionEquivalents) {
      let contractionMatched = false;
      // Check multi-token or single token expansion
      for (let i = 0; i < spokenTokens.length; i++) {
        if (!usedSpokenIndices.has(i)) {
          const t1 = spokenTokens[i];
          const t2 = spokenTokens[i + 1];
          if (t1 && t2 && !usedSpokenIndices.has(i + 1)) {
            const combined = `${t1} ${t2}`;
            if (
              (cleanWord === "i'm" && combined === "i am") ||
              (cleanWord === "don't" && combined === "do not") ||
              (cleanWord === "can't" && (combined === "can not" || t1 === "cannot")) ||
              (cleanWord === "it's" && combined === "it is") ||
              (cleanWord === "that's" && combined === "that is") ||
              (cleanWord === "you're" && combined === "you are")
            ) {
              usedSpokenIndices.add(i);
              usedSpokenIndices.add(i + 1);
              evaluatedWords.push({ word: rawWord, status: 'correct' });
              matchedScore += 1.0;
              contractionMatched = true;
              break;
            }
          }
          if (contractionEquivalents.includes(t1)) {
            usedSpokenIndices.add(i);
            evaluatedWords.push({ word: rawWord, status: 'correct' });
            matchedScore += 1.0;
            contractionMatched = true;
            break;
          }
        }
      }
      if (contractionMatched) continue;
    }

    // 3. Close fuzzy match (similarity >= 0.72)
    let bestSim = 0;
    let bestCloseIdx = -1;
    for (let i = 0; i < spokenTokens.length; i++) {
      if (!usedSpokenIndices.has(i)) {
        const sim = wordSimilarity(cleanWord, spokenTokens[i]);
        if (sim > bestSim) {
          bestSim = sim;
          bestCloseIdx = i;
        }
      }
    }

    if (bestSim >= 0.72 && bestCloseIdx !== -1) {
      usedSpokenIndices.add(bestCloseIdx);
      evaluatedWords.push({ word: rawWord, status: 'imperfect' });
      matchedScore += 0.75;
    } else {
      evaluatedWords.push({ word: rawWord, status: 'missing' });
    }
  }

  // Realistic scoring: chunk words coverage is primary; slight penalty only if rambling with excessive extra words
  const targetCoverage = targetWords.length > 0 ? (matchedScore / targetWords.length) * 100 : 0;
  const excessTokens = Math.max(0, spokenTokens.length - (targetWords.length + 3));
  const penalty = excessTokens * 4;
  const score = Math.max(0, Math.min(100, Math.round(targetCoverage - penalty)));

  return {
    score,
    words: evaluatedWords,
    isMatch: score >= 60,
  };
}

@Injectable({
  providedIn: 'root'
})
export class ScenarioService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getScenarios(filter?: {
    category?: string;
    level?: string;
    status?: string;
    q?: string;
  }): Observable<ScenarioLibraryResponse> {
    let params = new HttpParams();
    if (filter?.category && filter.category !== 'all') {
      params = params.set('category', filter.category);
    }
    if (filter?.level && filter.level !== 'all' && filter.level !== 'Tất cả') {
      params = params.set('level', filter.level);
    }
    if (filter?.status && filter.status !== 'all') {
      params = params.set('status', filter.status);
    }
    if (filter?.q) {
      params = params.set('q', filter.q);
    }
    return this.http.get<ScenarioLibraryResponse>(`${this.baseUrl}/scenarios`, { params });
  }

  getScenario(idOrSlug: string): Observable<ScenarioDetail> {
    return this.http.get<ScenarioDetail>(`${this.baseUrl}/scenarios/${idOrSlug}`);
  }

  getScenarioChunks(id: string): Observable<ScenarioChunksResponse> {
    return this.http.get<ScenarioChunksResponse>(`${this.baseUrl}/scenarios/${id}/chunks`);
  }

  recordDrill(scenarioId: string, req: RecordDrillRequest): Observable<RecordDrillResponse> {
    return this.http.post<RecordDrillResponse>(`${this.baseUrl}/scenarios/${scenarioId}/drills`, req);
  }

  startRoleplay(scenarioId: string): Observable<RoleplaySessionResponse> {
    return this.http.post<RoleplaySessionResponse>(`${this.baseUrl}/scenarios/${scenarioId}/roleplays`, {});
  }

  addRoleplayTranscript(sessionId: string, data: {
    id: string;
    speaker: 'USER' | 'AI';
    text: string;
    startMs?: number;
    endMs?: number;
    confidence?: number;
    isFinal?: boolean;
  }): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/roleplays/${sessionId}/transcript`, data);
  }

  endRoleplay(sessionId: string, reason = 'USER_REQUESTED'): Observable<RoleplayEndResponse> {
    return this.http.post<RoleplayEndResponse>(`${this.baseUrl}/roleplays/${sessionId}/end`, { reason });
  }

  getRoleplayEvaluation(sessionId: string): Observable<RoleplayEvaluationResponse> {
    return this.http.get<RoleplayEvaluationResponse>(`${this.baseUrl}/roleplays/${sessionId}/evaluation`);
  }

  getChunkBank(status?: string): Observable<ChunkBankResponse> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<ChunkBankResponse>(`${this.baseUrl}/me/chunk-bank`, { params });
  }

  playChunkAudio(text: string, audioUrl?: string | null, slow = false): void {
    const rate = slow ? 0.65 : 0.9;
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.playbackRate = slow ? 0.65 : 1.0;
      audio.play().catch(() => this.fallbackSpeak(text, rate));
    } else {
      this.fallbackSpeak(text, rate);
    }
  }

  private fallbackSpeak(text: string, rate = 0.9): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = rate;
      window.speechSynthesis.speak(utterance);
    }
  }
}
