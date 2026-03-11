import { NextResponse } from 'next/server';
import { TTS_AUDIO_TAGS_SYSTEM_PROMPT, TTS_ENHANCE_NO_TAGS_SYSTEM_PROMPT } from '@/lib/tts-audio-tags-prompt';

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const OLLAMA_TIMEOUT_MS = Math.min(120000, Math.max(5000, (Number(process.env.OLLAMA_TIMEOUT_SECONDS) || 45) * 1000));
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: Request) {
  try {
    const { text, mode } = await req.json();
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Missing or invalid text' }, { status: 400 });
    }
    const useNoTags = mode === 'enhance';
    const systemPrompt = useNoTags ? TTS_ENHANCE_NO_TAGS_SYSTEM_PROMPT : TTS_AUDIO_TAGS_SYSTEM_PROMPT;

    let enhanced: string;

    if (OPENAI_API_KEY) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text },
          ],
          temperature: 0.3,
          max_tokens: 2048,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error('[tts-enhance] OpenAI error:', res.status, err);
        return NextResponse.json({ error: 'LLM request failed' }, { status: 502 });
      }
      const data = await res.json();
      enhanced = data.choices?.[0]?.message?.content?.trim() ?? text;
    } else {
      const tryFetch = async (baseUrl: string) => {
        const url = `${baseUrl.replace(/\/$/, '')}/api/chat`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: OLLAMA_MODEL,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text },
              ],
              stream: false,
              options: { temperature: 0.3, num_predict: 2048 },
            }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          return res;
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      };

      let res: Response;
      try {
        res = await tryFetch(OLLAMA_BASE);
      } catch (fetchErr) {
        const isAbort = fetchErr instanceof Error && fetchErr.name === 'AbortError';
        // If remote failed and it's not localhost, try localhost as fallback
        if (OLLAMA_BASE.includes('168.231.78.113') || (!OLLAMA_BASE.includes('localhost') && !OLLAMA_BASE.includes('127.0.0.1'))) {
          try {
            console.log(`[tts-enhance] Remote Ollama (${OLLAMA_BASE}) unreachable, trying localhost fallback...`);
            res = await tryFetch('http://localhost:11434');
          } catch (localErr) {
            console.error(`[tts-enhance] Local Ollama fallback also failed:`, localErr);
            if (isAbort) {
              return NextResponse.json(
                { error: `Ollama took too long (${OLLAMA_TIMEOUT_MS / 1000}s). Is the server at ${OLLAMA_BASE} (or localhost) running and is the model "${OLLAMA_MODEL}" pulled?` },
                { status: 502 }
              );
            }
            return NextResponse.json(
              { error: `Cannot reach Ollama at ${OLLAMA_BASE} or localhost. Check network/firewall and that Ollama is running.` },
              { status: 502 }
            );
          }
        } else {
          if (isAbort) {
            return NextResponse.json(
              { error: `Ollama took too long (${OLLAMA_TIMEOUT_MS / 1000}s). Is the server at ${OLLAMA_BASE} running and is the model "${OLLAMA_MODEL}" pulled?` },
              { status: 502 }
            );
          }
          return NextResponse.json(
            { error: `Cannot reach Eburon AI at ${OLLAMA_BASE}. Is the server running and reachable from this machine?` },
            { status: 502 }
          );
        }
      }
      if (!res.ok) {
        const err = await res.text();
        console.error('[tts-enhance] Eburon AI (Ollama) error:', res.status, err);
        let errDetail = '';
        try {
          const parsed = JSON.parse(err) as { error?: string };
          if (parsed?.error) errDetail = ` — ${parsed.error}`;
        } catch {
          if (err) errDetail = ` — ${err.slice(0, 200)}`;
        }
        return NextResponse.json(
          {
            error: `Eburon AI returned ${res.status}. Check that the server at ${OLLAMA_BASE} is running and the model "${OLLAMA_MODEL}" exists.${errDetail}`,
          },
          { status: 502 }
        );
      }
      const data = await res.json();
      enhanced = data.message?.content?.trim() ?? text;
    }

    return NextResponse.json({ enhanced });
  } catch (err) {
    const { toEburonError, eburonJsonResponse } = await import('@/lib/eburon');
    const eburonErr = toEburonError(err);
    console.error('[tts-enhance]', { code: eburonErr.code, detail: eburonErr.detail });
    return NextResponse.json(...eburonJsonResponse(eburonErr));
  }
}
