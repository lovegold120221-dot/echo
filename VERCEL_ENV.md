# Vercel Environment Variables

Copy these **exact** variable names into your Vercel project (Settings → Environment Variables). Fill in your own values.

## Required

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (e.g. `https://xxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `NEXT_PUBLIC_ORBIT_TOKEN` | Orbit public API key (client-side web calls) |
| `VAPI_PRIVATE_API_KEY` | VAPI/Orbit private API key (server-side agents) |
| `VAPI_PHONE_NUMBER_ID` | Phone number ID for outbound calls |
| `TTS_PROVIDER_KEY` | TTS provider API key (or use `ELEVENLABS_API_KEY`) |

## Optional (TTS provider aliases)

| Variable | Description |
|----------|-------------|
| `ECHO_PROVIDER_KEY` | Alternative to `TTS_PROVIDER_KEY` |
| `ELEVENLABS_API_KEY` | Alternative to `TTS_PROVIDER_KEY` |
| `ECHO_PROVIDER_BASE_URL` | Override TTS API base URL (default: ElevenLabs) |

## Optional (LiveKit for web calls)

| Variable | Description |
|----------|-------------|
| `LIVEKIT_URL` | LiveKit WebSocket URL |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |

## Optional (Expression enhancer)

| Variable | Description |
|----------|-------------|
| `OLLAMA_BASE_URL` | Ollama server URL (e.g. `http://localhost:11434`) |
| `OLLAMA_MODEL` | Ollama model name |
| `OLLAMA_TIMEOUT_SECONDS` | Timeout for Ollama requests |
| `GEMINI_API_KEY` | **Primary LLM** (Gemini 1.5 Flash) |
| `OPENAI_API_KEY` | Secondary fallback if Gemini is missing/fails |

## Optional (agents)

| Variable | Description |
|----------|-------------|
| `ORBIT_SECRET` | Alternative to `VAPI_PRIVATE_API_KEY` |
| `PHONE_NUMBER_ID` | Alternative to `VAPI_PHONE_NUMBER_ID` |
| `NEXT_PUBLIC_VAPI_ASSISTANT_IVAN_ID` | Default assistant ID for Create My Agent |

---

**Copy-paste list (names only):**

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_ORBIT_TOKEN
VAPI_PRIVATE_API_KEY
VAPI_PHONE_NUMBER_ID
TTS_PROVIDER_KEY
ECHO_PROVIDER_BASE_URL
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
OLLAMA_BASE_URL
OLLAMA_MODEL
OLLAMA_TIMEOUT_SECONDS
OPENAI_API_KEY
ORBIT_SECRET
PHONE_NUMBER_ID
NEXT_PUBLIC_VAPI_ASSISTANT_IVAN_ID
ELEVENLABS_API_KEY
ECHO_PROVIDER_KEY
GEMINI_API_KEY
```
