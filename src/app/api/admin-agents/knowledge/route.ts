import { NextResponse } from 'next/server';
import { createSupabaseClientFromRequest } from '@/lib/supabase-server';
import { uploadFile } from '@/lib/services/orbit';

export const dynamic = 'force-dynamic';

const BUCKET = 'admin-agent-kb';
const MAX_FILE_BYTES = 1024 * 1024 * 1024;

const ACCEPTED_TYPES = [
  'text/plain',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/csv',
  'text/markdown',
  'text/tab-separated-values',
  'application/x-yaml',
  'application/json',
  'application/xml',
  'text/x-log',
];

const ALLOWED_EXTS = ['txt', 'pdf', 'docx', 'doc', 'csv', 'md', 'tsv', 'yaml', 'yml', 'json', 'xml', 'log'];

type KnowledgeRow = {
  id: string;
  assistant_id: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number;
  vapi_file_id: string;
  created_at: string;
  updated_at: string;
};

function cleanFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function toResponseRow(row: KnowledgeRow) {
  return {
    id: row.id,
    assistantId: row.assistant_id,
    fileName: row.file_name,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    vapiFileId: row.vapi_file_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isAllowedFile(file: File) {
  const ext = file.name?.split('.').pop()?.toLowerCase() || '';
  return ACCEPTED_TYPES.includes(file.type || '') || ALLOWED_EXTS.includes(ext);
}

export async function GET(request: Request) {
  const supabase = createSupabaseClientFromRequest(request);
  if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const assistantIdParam = searchParams.get('assistantId')?.trim() || '';

    let query = supabase
      .from('admin_agent_knowledge')
      .select('id, assistant_id, file_name, storage_path, mime_type, size_bytes, vapi_file_id, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (assistantIdParam) {
      query = query.eq('assistant_id', assistantIdParam);
    } else {
      query = query.is('assistant_id', null);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[admin-agents/knowledge GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json((data || []).map((row) => toResponseRow(row as KnowledgeRow)));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch knowledge files';
    console.error('[admin-agents/knowledge GET]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = createSupabaseClientFromRequest(request);
  if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const assistantIdRaw = formData.get('assistantId');
    const assistantId = typeof assistantIdRaw === 'string' && assistantIdRaw.trim() ? assistantIdRaw.trim() : null;

    if (!file?.size) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'File too large. Keep files under 1GB.' }, { status: 400 });
    }
    if (!isAllowedFile(file)) {
      return NextResponse.json({ error: `Unsupported file type. Use: ${ALLOWED_EXTS.join(', ')}` }, { status: 400 });
    }

    const safeName = cleanFilename(file.name || 'document');
    const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;

    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (storageError) {
      console.error('[admin-agents/knowledge POST] storage upload error:', storageError);
      return NextResponse.json({ error: 'Failed to save file to storage' }, { status: 500 });
    }

    let vapiFileId = '';
    try {
      const vapiFile = await uploadFile(file, file.name);
      vapiFileId = vapiFile.id;
    } catch (error) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      const message = error instanceof Error ? error.message : 'Failed to upload file to VAPI';
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const { data, error: insertError } = await supabase
      .from('admin_agent_knowledge')
      .insert({
        user_id: user.id,
        assistant_id: assistantId,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type || null,
        size_bytes: file.size,
        vapi_file_id: vapiFileId,
        updated_at: new Date().toISOString(),
      })
      .select('id, assistant_id, file_name, storage_path, mime_type, size_bytes, vapi_file_id, created_at, updated_at')
      .single();

    if (insertError || !data) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      console.error('[admin-agents/knowledge POST] insert error:', insertError);
      return NextResponse.json({ error: insertError?.message || 'Failed to save knowledge record' }, { status: 500 });
    }

    return NextResponse.json(toResponseRow(data as KnowledgeRow));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload knowledge file';
    console.error('[admin-agents/knowledge POST]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const supabase = createSupabaseClientFromRequest(request);
  if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const assistantId = typeof body?.assistantId === 'string' ? body.assistantId.trim() : '';
    const knowledgeIds = Array.isArray(body?.knowledgeIds)
      ? body.knowledgeIds.filter((id: unknown): id is string => typeof id === 'string' && !!id.trim())
      : [];

    if (!assistantId || knowledgeIds.length === 0) {
      return NextResponse.json({ error: 'assistantId and knowledgeIds are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('admin_agent_knowledge')
      .update({
        assistant_id: assistantId,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .in('id', knowledgeIds)
      .select('id');

    if (error) {
      console.error('[admin-agents/knowledge PUT]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ updated: data?.length || 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to link knowledge files';
    console.error('[admin-agents/knowledge PUT]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabase = createSupabaseClientFromRequest(request);
  if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { data: row, error: selectError } = await supabase
      .from('admin_agent_knowledge')
      .select('id, storage_path')
      .eq('user_id', user.id)
      .eq('id', id)
      .single();

    if (selectError || !row) {
      return NextResponse.json({ error: 'Knowledge file not found' }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from('admin_agent_knowledge')
      .delete()
      .eq('user_id', user.id)
      .eq('id', id);

    if (deleteError) {
      console.error('[admin-agents/knowledge DELETE] row delete error:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    if (row.storage_path) {
      const { error: storageDeleteError } = await supabase.storage.from(BUCKET).remove([row.storage_path]);
      if (storageDeleteError) {
        console.warn('[admin-agents/knowledge DELETE] storage delete warning:', storageDeleteError.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete knowledge file';
    console.error('[admin-agents/knowledge DELETE]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
