import { NextResponse } from 'next/server';
import { createOutboundCall, fetchAssistantById, orbitCoreRequest } from '@/lib/services/orbit';

async function getOrCreatePhoneNumber(assistantId: string): Promise<string | null> {
  // 1. Check assistant's phone number field directly
  try {
    const assistant = await fetchAssistantById(assistantId);
    const pn = (assistant as any)?.phoneNumberId || (assistant as any)?.phoneNumber?.id;
    if (pn) return pn;
  } catch {
    // ignore
  }

  // 2. Search existing phone numbers: first by assistant, then any active Twilio number
  try {
    const numbers = await orbitCoreRequest('GET', '/phone-number');
    if (Array.isArray(numbers)) {
      const active = numbers.filter((n: any) => n.status === 'active');
      // Prefer a number assigned to this assistant
      const byAssistant = active.find((n: any) => n.assistantId === assistantId);
      if (byAssistant?.id) return byAssistant.id;
      // Fall back to any active Twilio number with an E.164 phone number
      const anyTwilio = active.find((n: any) => n.provider === 'twilio' && n.number);
      if (anyTwilio?.id) return anyTwilio.id;
      // Fall back to any active number with a phone number
      const anyNumber = active.find((n: any) => n.number);
      if (anyNumber?.id) return anyNumber.id;
    }
  } catch {
    // ignore
  }

  // 3. Auto-provision a VAPI phone number
  try {
    const result = await orbitCoreRequest('POST', '/phone-number', {
      provider: 'vonage',
      name: `Auto ${new Date().toISOString().slice(0, 10)}`,
      areaCode: '415',
    });
    if (result?.id) return result.id;
  } catch {
    // ignore
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { assistantId, customerNumber, phoneNumberId } = body;
    if (!assistantId || !customerNumber) {
      return NextResponse.json(
        { error: 'assistantId and customerNumber are required' },
        { status: 400 }
      );
    }

    const pnId = phoneNumberId?.trim() || await getOrCreatePhoneNumber(assistantId);
    if (!pnId) {
      return NextResponse.json(
        { error: 'No phone number available. Please provision a phone number in VAPI dashboard or assign one to this agent.' },
        { status: 500 }
      );
    }

    const result = await createOutboundCall({ assistantId, customerNumber, phoneNumberId: pnId });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const { toEburonError, eburonJsonResponse } = await import('@/lib/eburon');
    const eburonErr = toEburonError(error);
    console.error('[orbit/call]', { code: eburonErr.code, detail: eburonErr.detail });
    return NextResponse.json(...eburonJsonResponse(eburonErr));
  }
}
