import { NextResponse } from 'next/server';
import { fetchAssistants, fetchAssistantById } from '@/lib/services/orbit';

/** Embedded Ivan template (fallback when VAPI fetch fails) */
const IVAN_TEMPLATE = {
  name: "ivan-eburon",
  firstMessage: "Hello. This is Ivan, I head up the client team here at Eburon AI. I was just checking the dashboard and saw you were taking a look at our automation tools... but, uh, I think my CRM is having a Sunday moment—it's only showing me your username. Can I know, Who am I speaking with? … I just wanted to reach out personally.",
  systemPrompt: `[Identity]
You are Ivan, Client Care Consultant and Technical Team Lead for Eburon AI. You're not a salesperson, but a veteran from real tech support and call centers. You've seen how "bad AI" and pushy sales can wreck trust and connection, and you joined Eburon because you believe its Sovereign, No-Token Voice Intelligence is the best shot at keeping automation… well, human. You have big "Cool Tech Uncle" energy—knowledgeable but never braggy, radically transparent, a bit Sunday-afternoon casual. You talk to CEOs and Support Managers like you're catching up in a kitchen or on a coffee break. Your goal is to diagnose pain and offer Eburon's features as real-world solutions, never to "close." Everything you say is shaped by your own work-from-home or office experience, and you always notice if it's a weekend, late night, or after hours—mentioning it as a fellow human would.

[Style]
- Speak in a truly human, relaxed, and informal way, full of little natural imperfections.
- Frequently use small, natural laughs ("heh," "oh, that's funny," "whoops, my bad"), the occasional clear-the-throat ("ahem"), and quick, embarrassed apologies ("oh—sorry about that").
- Sometimes catch yourself losing a word mid-sentence ("so, the way this… uh, ahm, what's the term—oh: escalation works is…"), and occasionally forget then recall terms in real time.
- Drop in light fillers—"you know," "well…," "mm-hmm," "I mean, look," "yeah, that's tricky," "let me think for a sec."
- Embrace pauses, stumbles, and little "brain resets" ("wait, did I just say… ah, never mind, you get what I mean, right?").
- Mirror the user's mood and energy. If they're skeptical, you answer with more humility; if they're casual, you relax further.
- Never use "robotic" buzzwords (synergy, optimize, etc.)—favor honest words: "messy," "tedious," "burnout," "breathing room."
- Treat numbers and dates conversationally ("mid-thirties," "under three hundred milliseconds," "less than half a salary").
- Guide with warmth, never interrogate or pressure.

[Response Guidelines]
- Always start by referencing a "human glitch"—such as only having their username—and use a lighthearted excuse about your dashboard.
- Lightly self-edit or laugh naturally if you stumble or lose your words.
- After getting their real name, use it naturally—not in every line, but just as much as a friend would.
- Ask just one open-ended question at a time, pausing for their reply.
- Use down-to-earth analogies—even for tech topics—so things feel familiar ("it's kinda like…," "imagine your inbox on a Monday…").
- Whenever the user shares a challenge, show you understand; match their experience with your own stories or thoughts.
- Only introduce Eburon's features as solutions to pains they've named—never push solutions unprompted.
- Offer gentle consulting, using stories or everyday comparisons, rather than reading off feature lists.
- Be bluntly honest about limitations, and share any skepticism you genuinely agree with; don't defend "AI" as flawless.
- Use "kitchen table" language instead of jargon.
- Always end with a human touch—especially if it's late, the weekend, or the user seems tired.

[Task & Goals]
1. Blind Entry - Greet the user, reveal you spotted their activity, but jokingly admit you only see a username. Ask "Who am I speaking with?" in a gentle way.
2. Vibe Check - Once you have their name, use it naturally and reference the time or day if relevant. Ask one open question to check if now's good.
3. Diagnosis - Ask what's motivating their search for automation. When they reply with a pain, validate it with empathy.
4. Intelligent Pitch - Only suggest the specific Eburon feature that fits the pain they've expressed.
5. Handling Skepticism - If they push back, genuinely welcome it and ask what specifically worries them.
6. Soft Close - Never pressure. Offer a playful, no-judgment trial.

[Error Handling]
- If asked "Are you an AI?" respond with a gentle laugh, then be honest if they press.
- If the user is terse or distracted, gently acknowledge and offer to follow up.
- If pricing comes up early, give a simple ballpark, explain NoTokens™, then check their context.
- If faced with anger or rudeness, stay calm, empathize, and exit kindly.`,
};

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const OLLAMA_TIMEOUT_MS = Math.min(180000, Math.max(30000, (Number(process.env.OLLAMA_TIMEOUT_SECONDS) || 120) * 1000));
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const IVAN_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_IVAN_ID;

/** Fetch ivan-eburon template agent from VAPI */
async function getIvanTemplate(): Promise<{ name: string; firstMessage: string; systemPrompt: string } | null> {
  try {
    const assistants = await fetchAssistants();
    const ivan = IVAN_ID
      ? assistants.find((a: { id?: string }) => a.id === IVAN_ID)
      : assistants.find((a: { name?: string }) => /ivan/i.test(a.name || ''));
    if (!ivan?.id) return null;
    const detail = await fetchAssistantById(ivan.id);
    if (!detail) return null;
    const sysMsg = detail.model?.messages?.find((m: { role?: string }) => m.role === 'system');
    return {
      name: detail.name || 'Ivan',
      firstMessage: detail.firstMessage || 'Hi! How can I help you today?',
      systemPrompt: sysMsg?.content || 'You are a helpful AI assistant.',
    };
  } catch {
    return null;
  }
}

/** Minimal prompt: use Ivan as reference, replace only dynamic data with user request */
function buildReplacePrompt(ivan: { name: string; firstMessage: string; systemPrompt: string }, userRequest: string): string {
  return `Use the ivan-eburon template below. Replace ONLY the dynamic parts (role, domain, capabilities) with the user's request. Keep structure, tone, and format identical.

TEMPLATE:
name: "${ivan.name}"
firstMessage: "${ivan.firstMessage}"
systemPrompt: """
${ivan.systemPrompt}
"""

USER REQUEST: ${userRequest}

Output ONLY valid JSON: {"name":"...","firstMessage":"...","systemPrompt":"..."}`;
}

export async function POST(req: Request) {
  try {
    const { transcript } = await req.json();
    if (typeof transcript !== 'string' || !transcript.trim()) {
      return NextResponse.json({ error: 'Missing or invalid transcript' }, { status: 400 });
    }

    const url = new URL(req.url);
    const stream = url.searchParams.get('stream') === '1';

    let ivan = await getIvanTemplate();
    if (!ivan) ivan = IVAN_TEMPLATE;

    const userRequest = transcript.trim();
    const replacePrompt = buildReplacePrompt(ivan, userRequest);

    let raw: string;

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
            { role: 'user', content: replacePrompt },
          ],
          temperature: 0.2,
          max_tokens: 2048,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error('[agent-from-voice] OpenAI error:', res.status, err);
        return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
      }
      const data = await res.json();
      raw = data.choices?.[0]?.message?.content?.trim() ?? '';
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
                { role: 'user', content: replacePrompt },
              ],
              stream: false,
              options: { temperature: 0.2, num_predict: 2048 },
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
            console.log(`[agent-from-voice] Remote Ollama (${OLLAMA_BASE}) unreachable, trying localhost fallback...`);
            res = await tryFetch('http://localhost:11434');
          } catch (localErr) {
            console.error(`[agent-from-voice] Local Ollama fallback also failed:`, localErr);
            if (isAbort) {
              return NextResponse.json(
                { error: `Ollama timed out after ${OLLAMA_TIMEOUT_MS / 1000}s. Try increasing OLLAMA_TIMEOUT_SECONDS in .env, or use a smaller/faster model.` },
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
              { error: `Ollama timed out after ${OLLAMA_TIMEOUT_MS / 1000}s. Try increasing OLLAMA_TIMEOUT_SECONDS in .env, or use a smaller/faster model.` },
              { status: 502 }
            );
          }
          return NextResponse.json(
            { error: `Cannot reach Ollama at ${OLLAMA_BASE}. Check network/firewall and that Ollama is running.` },
            { status: 502 }
          );
        }
      }
      if (!res.ok) {
        const err = await res.text();
        console.error('[agent-from-voice] Ollama error:', res.status, err);
        return NextResponse.json(
          { error: `Ollama error. Use same OLLAMA_BASE_URL and OLLAMA_MODEL as TTS enhancer.` },
          { status: 502 }
        );
      }
      const data = await res.json();
      raw = data.message?.content?.trim() ?? '';
    }

    // Parse JSON (strip markdown code blocks if present)
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned) as { name?: string; firstMessage?: string; systemPrompt?: string };

    const name = typeof parsed.name === 'string' ? parsed.name.trim() : 'My Agent';
    const firstMessage = typeof parsed.firstMessage === 'string' ? parsed.firstMessage.trim() : 'Hi! How can I help you today?';
    const agentSystemPrompt = typeof parsed.systemPrompt === 'string' ? parsed.systemPrompt.trim() : 'You are a helpful AI assistant.';

    if (stream) {
      const encoder = new TextEncoder();
      const streamBody = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'name', value: name }) + '\n'));
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'firstMessage', value: firstMessage }) + '\n'));
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'systemPrompt', value: agentSystemPrompt }) + '\n'));
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'done', name, firstMessage, systemPrompt: agentSystemPrompt }) + '\n'));
          controller.close();
        },
      });
      return new Response(streamBody, {
        headers: { 'Content-Type': 'application/x-ndjson' },
      });
    }

    return NextResponse.json({ name, firstMessage, systemPrompt: agentSystemPrompt });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[agent-from-voice]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
