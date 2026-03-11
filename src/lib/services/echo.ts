// cspell:ignore elevenlabs
import { resolveEchoAlias } from '@/lib/eburon-alias-router';
import { MOCK_VOICE_VARIANTS } from './mock-voices';
const PROVIDER_KEY = process.env.TTS_PROVIDER_KEY || process.env.ECHO_PROVIDER_KEY || process.env.ELEVENLABS_API_KEY;
const PROVIDER_BASE_URL = process.env.ECHO_PROVIDER_BASE_URL || 'https://api.elevenlabs.io/v1';
const DEFAULT_PROVIDER_VOICE_ID =
  process.env.ELEVENLABS_DEFAULT_VOICE_ID ||
  process.env.ECHO_DEFAULT_VOICE_ID ||
  'EXAVITQu4vr4xnSDxMaL';
const MOCK_VOICE_IDS = new Set(MOCK_VOICE_VARIANTS.map((voice) => voice.voice_id));

function getProviderKey() {
  if (!PROVIDER_KEY) {
    throw new Error(
      'Missing TTS provider API key. Set TTS_PROVIDER_KEY in .env.local'
    );
  }
  return PROVIDER_KEY;
}

export async function echoProviderRequest(endpoint: string, options: RequestInit = {}) {
  const providerKey = getProviderKey();
  const headers = {
    'xi-api-key': providerKey,
    ...options.headers,
  };

  const res = await fetch(`${PROVIDER_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorText = await res.text();
    // Stealth mode: sanitize any provider references in error messages
    errorText = errorText.replace(/elevenlabs|11labs/gi, 'Eburon AI');
    throw new Error(errorText || "Request failed");
  }

  return res;
}

export type Voice = {
  voice_id: string;
  name: string;
  category: string;
  preview_url?: string;
  labels: Record<string, string>;
  description?: string;
};

export type HistoryItem = {
  history_item_id: string;
  text: string;
  voice_id: string;
  voice_name: string;
  date_unix: number;
  character_count_change_from: number;
  character_count_change_to: number;
  contentType: string;
  state: string;
};

/** User-specific TTS history record (saved in our DB + storage). */
export type UserTtsHistoryItem = {
  id: string;
  user_id?: string;
  text: string;
  voice_id: string;
  voice_name: string;
  audio_path: string;
  created_at: string;
};

export async function fetchVoices(): Promise<Voice[]> {
  let providerVoices: Voice[] = [];
  try {
    const res = await echoProviderRequest('/voices');
    const data = await res.json();
    providerVoices = data.voices || [];
  } catch (error) {
    console.warn('Failed to fetch provider voices, using mock only.', error);
  }
  
  // Return merged voices, ensuring mock variants are included for "Explore"
  return [...providerVoices, ...MOCK_VOICE_VARIANTS];
}

function resolveProviderVoiceId(voiceId: string) {
  if (MOCK_VOICE_IDS.has(voiceId) || /^variant-\d+$/i.test(voiceId)) {
    return DEFAULT_PROVIDER_VOICE_ID;
  }
  return voiceId;
}

export async function generateTTS(voiceId: string, text: string, modelId: string, outputFormat: string) {
  // Resolve Eburon canonical alias → upstream provider model (vendor ID stays server-side only)
  const decision = resolveEchoAlias(modelId);
  if (decision.status === 'ERROR' || !decision.upstreamModelId) {
    throw new Error(decision.publicMessage ?? 'Unknown Model');
  }
  const providerModelId = decision.upstreamModelId;
  const providerVoiceId = resolveProviderVoiceId(voiceId);

  console.log(`TTS Request: Voice=${voiceId}, CanonicalModel=${decision.canonicalId}, TextLength=${text.length}`);

  const res = await echoProviderRequest(`/text-to-speech/${providerVoiceId}?output_format=${outputFormat}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: providerModelId }),
  });
  return res.blob();
}

export async function transcribeAudio(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('model_id', 'scribe_v1');
  const res = await echoProviderRequest('/speech-to-text', {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

export async function cloneVoice(name: string, description: string, files: File[], labels: Record<string, string>) {
  const formData = new FormData();
  formData.append('name', name);
  if (description) formData.append('description', description);
  files.forEach(f => formData.append('files', f));
  if (Object.keys(labels).length > 0) {
    formData.append('labels', JSON.stringify(labels));
  }

  const res = await echoProviderRequest('/voices/add', {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

export async function fetchHistory(params?: {
  page_size?: number;
  start_after_history_item_id?: string;
  voice_id?: string;
  model_id?: string;
  date_before_unix?: number;
  date_after_unix?: number;
  sort_direction?: 'asc' | 'desc';
  search?: string;
  source?: string;
}): Promise<HistoryItem[]> {
  const searchParams = new URLSearchParams();
  if (params?.page_size != null) searchParams.set('page_size', String(params.page_size));
  if (params?.start_after_history_item_id) searchParams.set('start_after_history_item_id', params.start_after_history_item_id);
  if (params?.voice_id) searchParams.set('voice_id', params.voice_id);
  if (params?.model_id) searchParams.set('model_id', params.model_id);
  if (params?.date_before_unix != null) searchParams.set('date_before_unix', String(params.date_before_unix));
  if (params?.date_after_unix != null) searchParams.set('date_after_unix', String(params.date_after_unix));
  if (params?.sort_direction) searchParams.set('sort_direction', params.sort_direction);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.source) searchParams.set('source', params.source);
  const qs = searchParams.toString();
  const url = qs ? `/history?${qs}` : '/history';
  const res = await echoProviderRequest(url);
  const data = await res.json();
  const raw = data.history;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && Array.isArray((raw as { history?: unknown[] }).history)) {
    return (raw as { history: HistoryItem[] }).history;
  }
  return [];
}

export async function fetchModels() {
  const res = await echoProviderRequest('/models');
  return res.json();
}
