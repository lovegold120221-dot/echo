import { NextResponse } from 'next/server';
import { createSupabaseClientFromRequest } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

type AdminAgentRow = {
  id: string;
  user_id: string;
  assistant_id: string;
  name: string;
  phone_number_id: string | null;
  voice_provider: string | null;
  voice_id: string | null;
  language: string | null;
  first_message: string | null;
  system_prompt: string | null;
  created_at: string;
  updated_at: string;
};

function getClient(request: Request) {
  return createSupabaseClientFromRequest(request);
}

export async function GET(request: Request) {
  const supabase = getClient(request);
  if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('admin-agent')
      .select('id, user_id, assistant_id, name, phone_number_id, voice_provider, voice_id, language, first_message, system_prompt, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[admin-agents GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []) as AdminAgentRow[];
    return NextResponse.json(rows.map((row) => ({
      id: row.id,
      assistantId: row.assistant_id,
      name: row.name,
      phoneNumberId: row.phone_number_id,
      voiceProvider: row.voice_provider,
      voiceId: row.voice_id,
      language: row.language,
      firstMessage: row.first_message,
      systemPrompt: row.system_prompt,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch admin agents';
    console.error('[admin-agents GET]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = getClient(request);
  if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const assistantId = typeof body?.assistantId === 'string' ? body.assistantId.trim() : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';

    if (!assistantId || !name) {
      return NextResponse.json({ error: 'assistantId and name are required' }, { status: 400 });
    }

    const payload = {
      user_id: user.id,
      assistant_id: assistantId,
      name,
      phone_number_id: typeof body?.phoneNumberId === 'string' && body.phoneNumberId.trim() ? body.phoneNumberId.trim() : null,
      voice_provider: typeof body?.voiceProvider === 'string' && body.voiceProvider.trim() ? body.voiceProvider.trim() : null,
      voice_id: typeof body?.voiceId === 'string' && body.voiceId.trim() ? body.voiceId.trim() : null,
      language: typeof body?.language === 'string' && body.language.trim() ? body.language.trim() : 'multilingual',
      first_message: typeof body?.firstMessage === 'string' && body.firstMessage.trim() ? body.firstMessage.trim() : null,
      system_prompt: typeof body?.systemPrompt === 'string' && body.systemPrompt.trim() ? body.systemPrompt.trim() : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('admin-agent')
      .upsert(payload, { onConflict: 'user_id,assistant_id' })
      .select('id, assistant_id, name, phone_number_id, voice_provider, voice_id, language, first_message, system_prompt, created_at, updated_at')
      .single();

    if (error) {
      console.error('[admin-agents POST]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upsert admin agent';
    console.error('[admin-agents POST]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabase = getClient(request);
  if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const assistantId = typeof body?.assistantId === 'string' ? body.assistantId.trim() : '';
    if (!assistantId) {
      return NextResponse.json({ error: 'assistantId required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('admin-agent')
      .delete()
      .eq('user_id', user.id)
      .eq('assistant_id', assistantId);

    if (error) {
      console.error('[admin-agents DELETE]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete admin agent';
    console.error('[admin-agents DELETE]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
