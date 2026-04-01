// Server-side only: use private API key for fetching/creating assistants.
const SECRET =
  process.env.VAPI_PRIVATE_API_KEY ||
  process.env.ORBIT_SECRET ||
  process.env.VAPI_API_KEY ||
  '';

function getOrbitSecret() {
  return SECRET.trim();
}

export async function orbitCoreRequest(method: string, endpoint: string, payload: unknown = null) {
  const orbitSecret = getOrbitSecret();
  if (!orbitSecret) {
    throw new Error(
      'Missing assistant platform API key. Set ORBIT_SECRET in .env.local (server-side only).'
    );
  }

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${orbitSecret}`,
    },
    ...(method === 'GET' && { cache: 'no-store' as RequestCache }),
  };

  if (payload) {
    options.headers = {
      ...options.headers,
      'Content-Type': 'application/json',
    };
    options.body = JSON.stringify(payload);
  }

  const res = await fetch(`https://api.vapi.ai${endpoint}`, options);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Assistant platform request failed");
  }
  return res.json();
}

/** Upload a file to VAPI for use in knowledge bases. Returns file object with id. */
export async function uploadFile(file: Blob, filename?: string): Promise<{ id: string }> {
  const orbitSecret = getOrbitSecret();
  if (!orbitSecret) {
    throw new Error('Missing assistant platform API key. Set ORBIT_SECRET in .env.local (server-side only).');
  }
  const formData = new FormData();
  formData.append('file', file, filename || 'document');
  const res = await fetch('https://api.vapi.ai/file', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${orbitSecret}` },
    body: formData,
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'File upload failed');
  }
  const data = (await res.json()) as { id?: string };
  if (!data?.id) throw new Error('No file ID returned from the assistant platform');
  return { id: data.id };
}

/** Create a query tool with knowledge base files. Returns tool id. */
export async function createQueryTool(params: {
  name: string;
  description: string;
  fileIds: string[];
}): Promise<{ id: string }> {
  const { name, description, fileIds } = params;
  if (fileIds.length === 0) throw new Error('At least one file ID required');
  const payload = {
    type: 'query',
    function: { name: name.replace(/\s+/g, '-').toLowerCase() || 'knowledge-search' },
    knowledgeBases: [
      {
        provider: 'google',
        name,
        description,
        fileIds,
      },
    ],
  };
  const data = (await orbitCoreRequest('POST', '/tool', payload)) as { id?: string };
  if (!data?.id) throw new Error('No tool ID returned from the assistant platform');
  return { id: data.id };
}

export type VapiVoice = {
  voice_id: string;
  name: string;
  provider?: string;
  labels?: Record<string, string>;
  description?: string;
  preview_url?: string;
  category?: string;
  [key: string]: unknown;
};

export async function fetchVoices(): Promise<VapiVoice[]> {
  if (!getOrbitSecret()) return [];
  // Fetch all voices from the voice library (includes VAPI, 11labs, and other providers)
  const raw = await orbitCoreRequest('GET', '/voice-library');
  if (Array.isArray(raw)) {
    // Filter out deleted voices and map to expected format
    return raw
      .filter((voice: any) => !voice.isDeleted)
      .map((voice: any) => ({
        voice_id: voice.providerId,
        name: voice.name,
        provider: voice.provider,
        description: voice.description,
        preview_url: voice.previewUrl,
        category: voice.gender || 'default',
        labels: {
          gender: voice.gender || '',
          accent: voice.accent || '',
          language: voice.accent || '',
        },
      }));
  }
  return [];
}

export async function fetchAssistants() {
  // Keep the dashboard usable when Orbit is not configured.
  if (!getOrbitSecret()) return [];
  const raw = await orbitCoreRequest('GET', '/assistant');
  // VAPI returns an array; normalize in case of paginated/wrapped response.
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && Array.isArray((raw as { assistants?: unknown[] }).assistants)) {
    return (raw as { assistants: unknown[] }).assistants;
  }
  if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown[] }).data)) {
    return (raw as { data: unknown[] }).data;
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function createAgent(payload: unknown) {
  return orbitCoreRequest(
    'POST',
    '/assistant',
    isRecord(payload) ? normalizeAssistantPayloadForWebCall(payload) : payload
  );
}

type AssistantMessage = { role: string; content: string };

type AssistantModelConfig = {
  provider: string;
  model: string;
  messages: AssistantMessage[];
  toolIds?: string[];
  maxTokens?: number;
  temperature?: number;
};

type AssistantVoiceConfig = {
  provider: string;
  voiceId: string;
  inputPunctuationBoundaries?: string[];
};

type AssistantTranscriberConfig = {
  provider: string;
  model: string;
  language: string;
  numerals?: boolean;
  confidenceThreshold?: number;
  fallbackPlan?: {
    transcribers: Array<{
      provider: string;
      model: string;
      language: string;
    }>;
  };
};

type AssistantWebCallConfig = {
  clientMessages: string[];
  serverMessages: string[];
};

const DEFAULT_ASSISTANT_VOICE: AssistantVoiceConfig = {
  provider: '11labs',
  voiceId: 'EXAVITQu4vr4xnSDxMaL',
};

const GREGORY_MODEL_TEMPLATE = {
  provider: 'google' as const,
  model: 'gemini-3-flash-preview',
  maxTokens: 250,
  temperature: 0.4,
};

const GREGORY_TTS_PUNCTUATION_BOUNDARIES = [
  ':',
  ',',
  '||',
  '|',
  '॥',
  '।',
  '۔',
  '،',
  ')',
  ';',
  '?',
  '!',
  '.',
  '，',
  '。',
] as const;

const GREGORY_TRANSCRIBER_TEMPLATE = {
  provider: 'deepgram' as const,
  model: 'nova-3-general',
  numerals: false,
  confidenceThreshold: 0.4,
};

const DEFAULT_ASSISTANT_CLIENT_MESSAGES = [
  'conversation-update',
  'function-call',
  'hang',
  'model-output',
  'speech-update',
  'status-update',
  'transfer-update',
  'transcript',
  'tool-calls',
  'user-interrupted',
  'voice-input',
  'workflow.node.started',
  'assistant.started',
] as const;

const DEFAULT_ASSISTANT_SERVER_MESSAGES = [
  'conversation-update',
  'end-of-call-report',
  'function-call',
  'hang',
  'speech-update',
  'status-update',
  'tool-calls',
  'transfer-destination-request',
  'handoff-destination-request',
  'user-interrupted',
  'assistant.started',
] as const;

/** Assistant from VAPI (for get/update) */
export type VapiAssistant = {
  id: string;
  name?: string;
  firstMessage?: string;
  model?: { messages?: { role?: string; content?: string }[]; toolIds?: string[] };
  voice?: { provider?: string; voiceId?: string };
  transcriber?: { language?: string };
  clientMessages?: string[];
  serverMessages?: string[];
  [key: string]: unknown;
};

export async function fetchAssistantById(id: string) {
  if (!getOrbitSecret()) return null;
  return orbitCoreRequest('GET', `/assistant/${id}`) as Promise<VapiAssistant>;
}

export async function updateAssistant(id: string, payload: Partial<{
  name: string;
  firstMessage: string;
  firstMessageMode: string;
  model: AssistantModelConfig;
  voice: AssistantVoiceConfig;
  transcriber: AssistantTranscriberConfig;
  clientMessages: string[];
  serverMessages: string[];
}>) {
  return orbitCoreRequest('PATCH', `/assistant/${id}`, payload) as Promise<VapiAssistant>;
}

/**
 * Create a new assistant from scratch (full CreateAssistantDTO).
 * Used when user provides name, firstMessage, model.messages (system prompt), etc.
 * voice: { provider: 'vapi'|'11labs', voiceId: string }
 */
/** Valid Deepgram nova-2 transcriber language codes. Maps form values to valid API values. */
export const NOVA2_LANGUAGES = new Set([
  'en', 'bg', 'ca', 'zh', 'zh-CN', 'zh-HK', 'zh-Hans', 'zh-TW', 'zh-Hant', 'cs', 'da', 'da-DK',
  'nl', 'en-US', 'en-AU', 'en-GB', 'en-NZ', 'en-IN', 'et', 'fi', 'nl-BE', 'fr', 'fr-CA', 'de',
  'de-CH', 'el', 'hi', 'hu', 'id', 'it', 'ja', 'ko', 'ko-KR', 'lv', 'lt', 'ms', 'multi', 'no',
  'pl', 'pt', 'pt-BR', 'ro', 'ru', 'sk', 'es', 'es-419', 'sv', 'sv-SE', 'th', 'th-TH', 'tr', 'uk', 'vi',
]);

export function toNova2Language(lang: string | undefined): string {
  if (!lang) return 'en';
  if (lang === 'multilingual') return 'multi';
  if (NOVA2_LANGUAGES.has(lang)) return lang;
  return 'multi'; // fallback for unsupported (ar, fil, he, etc.)
}

function resolveAssistantLanguage(lang: string | undefined): string {
  if (!lang) return 'multi';
  return toNova2Language(lang);
}

function mergeAssistantMessages(existing: string[] | undefined, required: readonly string[]) {
  const merged = new Set<string>(required);
  existing?.forEach((item) => {
    if (typeof item === 'string' && item) merged.add(item);
  });
  return [...merged];
}

export function buildWebCallAssistantConfig(existing?: Pick<VapiAssistant, 'clientMessages' | 'serverMessages'>): AssistantWebCallConfig {
  return {
    clientMessages: mergeAssistantMessages(existing?.clientMessages, DEFAULT_ASSISTANT_CLIENT_MESSAGES),
    serverMessages: mergeAssistantMessages(existing?.serverMessages, DEFAULT_ASSISTANT_SERVER_MESSAGES),
  };
}

function normalizeAssistantPayloadForWebCall<T extends Record<string, unknown>>(payload: T): T & AssistantWebCallConfig {
  return {
    ...payload,
    ...buildWebCallAssistantConfig({
      clientMessages: Array.isArray(payload.clientMessages)
        ? payload.clientMessages.filter((value): value is string => typeof value === 'string')
        : undefined,
      serverMessages: Array.isArray(payload.serverMessages)
        ? payload.serverMessages.filter((value): value is string => typeof value === 'string')
        : undefined,
    }),
  };
}

export function buildAssistantModelConfig(systemPrompt: string, toolIds?: string[]): AssistantModelConfig {
  return {
    ...GREGORY_MODEL_TEMPLATE,
    messages: [
      { role: 'system', content: systemPrompt || 'You are a helpful AI assistant.' },
    ],
    ...(toolIds?.length ? { toolIds } : {}),
  };
}

export function buildAssistantVoiceConfig(
  voice?: { provider: 'vapi' | '11labs'; voiceId: string }
): AssistantVoiceConfig {
  const baseVoice = voice?.provider && voice?.voiceId
    ? { provider: voice.provider, voiceId: voice.voiceId }
    : DEFAULT_ASSISTANT_VOICE;

  return {
    ...baseVoice,
    inputPunctuationBoundaries: [...GREGORY_TTS_PUNCTUATION_BOUNDARIES],
  };
}

export function buildAssistantTranscriberConfig(language?: string): AssistantTranscriberConfig {
  const resolvedLanguage = resolveAssistantLanguage(language);

  return {
    ...GREGORY_TRANSCRIBER_TEMPLATE,
    language: resolvedLanguage,
    fallbackPlan: {
      transcribers: [
        {
          provider: 'deepgram',
          model: 'nova-3',
          language: resolvedLanguage,
        },
      ],
    },
  };
}

export async function createAssistantFromScratch(params: {
  name: string;
  firstMessage: string;
  systemPrompt: string;
  language?: string;
  voice?: { provider: 'vapi' | '11labs'; voiceId: string };
  toolIds?: string[];
  phoneNumberId?: string;
}) {
  const { name, firstMessage, systemPrompt, language, voice, toolIds, phoneNumberId } = params;
  const payload: Record<string, unknown> = {
    name,
    firstMessage: firstMessage || undefined,
    firstMessageMode: 'assistant-speaks-first' as const,
    model: buildAssistantModelConfig(systemPrompt, toolIds),
    voice: buildAssistantVoiceConfig(voice),
    transcriber: buildAssistantTranscriberConfig(language),
    ...buildWebCallAssistantConfig(),
  };
  if (phoneNumberId) payload.phoneNumberId = phoneNumberId;
  return orbitCoreRequest('POST', '/assistant', payload);
}

/**
 * Create an outbound phone call. Requires PHONE_NUMBER_ID in .env.
 */
export async function createOutboundCall(params: {
  assistantId: string;
  customerNumber: string;
  phoneNumberId?: string;
}) {
  const phoneNumberId = params.phoneNumberId?.trim();
  if (!phoneNumberId) {
    throw new Error(
      'Missing phoneNumberId. Assign a phone number to the assistant or pass one in the call request.'
    );
  }
  const e164 = params.customerNumber.startsWith('+')
    ? params.customerNumber
    : params.customerNumber.length === 10
      ? `+1${params.customerNumber}`
      : `+${params.customerNumber}`;
  const payload = {
    assistantId: params.assistantId,
    phoneNumberId,
    customer: { number: e164 },
  };
  return orbitCoreRequest('POST', '/call', payload);
}

/** Call record from VAPI list endpoint */
export type VapiCallRecord = {
  id: string;
  type?: 'inboundPhoneCall' | 'outboundPhoneCall' | 'webCall' | 'vapi.websocketCall';
  status?: string;
  customer?: { number?: string };
  assistantId?: string;
  createdAt?: string;
  endedAt?: string;
  [key: string]: unknown;
};

/**
 * List recent calls from VAPI.
 */
export async function fetchCalls(params?: { limit?: number; assistantId?: string }) {
  if (!getOrbitSecret()) return [];
  const limit = params?.limit ?? 20;
  const assistantId = params?.assistantId;
  const qs = new URLSearchParams();
  qs.set('limit', String(limit));
  if (assistantId) qs.set('assistantId', assistantId);
  const raw = await orbitCoreRequest('GET', `/call?${qs.toString()}`);
  if (Array.isArray(raw)) return raw as VapiCallRecord[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { calls?: unknown[] }).calls)) {
    return (raw as { calls: VapiCallRecord[] }).calls;
  }
  return [];
}

/**
 * Fetch a single call by ID (includes artifact with recordingUrl if recording was enabled).
 */
export async function fetchCallById(id: string) {
  if (!getOrbitSecret()) return null;
  return orbitCoreRequest('GET', `/call/${id}`) as Promise<VapiCallRecord & { artifact?: { recordingUrl?: string; stereoRecordingUrl?: string } }>;
}
