import { NextResponse } from 'next/server';
import { TTS_AUDIO_TAGS_SYSTEM_PROMPT, TTS_ENHANCE_NO_TAGS_SYSTEM_PROMPT } from '@/lib/tts-audio-tags-prompt';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
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

    const callGemini = async (sys: string, usr: string) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${sys}\n\nUSER INPUT: ${usr}` }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('[tts-enhance] Gemini error:', res.status, err);
        throw new Error(`Gemini failed: ${res.status}`);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return text || usr;
    };

    const callOpenAI = async (sys: string, usr: string) => {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: usr },
          ],
          temperature: 0.3,
          max_tokens: 2048,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error('[tts-enhance] OpenAI error:', res.status, err);
        throw new Error(`OpenAI failed: ${res.status}`);
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() ?? usr;
    };

    // PRIMARY: Gemini
    if (GEMINI_API_KEY) {
      try {
        enhanced = await callGemini(systemPrompt, text);
      } catch (geminiErr) {
        console.warn('[tts-enhance] Gemini failed, attempting OpenAI fallback...', geminiErr);
        if (OPENAI_API_KEY) {
          enhanced = await callOpenAI(systemPrompt, text);
        } else {
          throw geminiErr;
        }
      }
    } 
    // SECONDARY: OpenAI
    else if (OPENAI_API_KEY) {
      enhanced = await callOpenAI(systemPrompt, text);
    }
    // FALLBACK: Return original text if no AI keys
    else {
      console.warn('[tts-enhance] No LLM keys found, returning original text.');
      enhanced = text;
    }

    return NextResponse.json({ enhanced });
  } catch (err) {
    const { toEburonError, eburonJsonResponse } = await import('@/lib/eburon');
    const eburonErr = toEburonError(err);
    console.error('[tts-enhance]', { code: eburonErr.code, detail: eburonErr.detail });
    return NextResponse.json(...eburonJsonResponse(eburonErr));
  }
}
