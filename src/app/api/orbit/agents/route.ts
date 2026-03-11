import { NextResponse } from 'next/server';
import {
  createAgent,
  createAssistantFromScratch,
  updateAssistant,
  buildAssistantModelConfig,
  buildAssistantTranscriberConfig,
  buildAssistantVoiceConfig,
  createQueryTool,
  fetchAssistantById,
} from '@/lib/services/orbit';

const KNOWLEDGE_TOOL_NAME = 'knowledge-search';

function buildSystemPrompt(base: string, hasKnowledgeBase: boolean): string {
  if (!hasKnowledgeBase) return base;
  const instruction = `\n\nYou have a knowledge base with uploaded documents. You MUST use the '${KNOWLEDGE_TOOL_NAME}' tool to search your knowledge base before answering any question that could be answered from those documents. Treat the knowledge base as your primary source of truth—always call '${KNOWLEDGE_TOOL_NAME}' first when users ask about products, services, policies, procedures, or any topic that may be covered in your uploaded files. Do not rely on general knowledge when the answer might be in your documents.`;
  return base.trim() + instruction;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const fileIds = Array.isArray(body.fileIds) ? body.fileIds.filter((id: unknown) => typeof id === 'string') : [];
    let toolIds: string[] = [];

    if (fileIds.length > 0) {
      const { id: toolId } = await createQueryTool({
        name: KNOWLEDGE_TOOL_NAME,
        description: 'Contains custom knowledge base documents for answering user questions accurately.',
        fileIds,
      });
      toolIds = [toolId];
    }

    const systemPrompt = buildSystemPrompt(
      body.systemPrompt || 'You are a helpful AI assistant.',
      toolIds.length > 0
    );

    // Update existing assistant when assistantId is provided
    if (body.assistantId && body.name && (body.systemPrompt ?? body.firstMessage)) {
      const voice = body.voice
        ? { provider: body.voice.provider || '11labs', voiceId: body.voice.voiceId }
        : undefined;
      const existing = await fetchAssistantById(body.assistantId);
      const currentModel = existing?.model as { toolIds?: string[] } | undefined;
      const mergedToolIds = toolIds.length > 0 ? toolIds : currentModel?.toolIds;
      const result = await updateAssistant(body.assistantId, {
        name: body.name,
        firstMessage: body.firstMessage || undefined,
        model: buildAssistantModelConfig(systemPrompt, mergedToolIds),
        ...(voice && { voice: buildAssistantVoiceConfig(voice) }),
        ...(body.language !== undefined && {
          transcriber: buildAssistantTranscriberConfig(body.language),
        }),
      });
      return NextResponse.json(result);
    }
    // Create from scratch when assistantId is not provided
    if (!body.assistantId && body.name && (body.systemPrompt ?? body.firstMessage)) {
      const result = await createAssistantFromScratch({
        name: body.name,
        firstMessage: body.firstMessage || '',
        systemPrompt,
        language: body.language,
        voice: body.voice,
        toolIds: toolIds.length > 0 ? toolIds : undefined,
      });
      return NextResponse.json(result);
    }
    // Clone from existing assistant
    const result = await createAgent(body);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const raw = error instanceof Error ? error.message : 'Unknown error';
    const { toEburonError, eburonJsonResponse } = await import('@/lib/eburon');
    const eburonErr = toEburonError(error);
    const isValidationError = typeof raw === 'string' && (
      raw.includes('must be one of the following values') ||
      raw.includes('Bad Request') ||
      raw.includes('transcriber.provider') ||
      raw.includes('model.provider')
    );
    if (isValidationError) {
      return NextResponse.json(
        { error: 'Invalid agent configuration. Please try again or contact support.', code: eburonErr.code },
        { status: 400 },
      );
    }
    console.error('[orbit/agents]', { code: eburonErr.code, detail: eburonErr.detail });
    return NextResponse.json(...eburonJsonResponse(eburonErr));
  }
}
