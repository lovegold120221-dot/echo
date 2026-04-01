import { NextResponse } from 'next/server';
import { orbitCoreRequest } from '@/lib/services/orbit';

type OrbitPhoneNumber = {
  id: string;
  number?: string;
  name?: string;
  provider?: string;
  status?: string;
};

function normalizePhoneNumbers(raw: unknown): OrbitPhoneNumber[] {
  if (Array.isArray(raw)) return raw as OrbitPhoneNumber[];
  if (raw && typeof raw === 'object') {
    const obj = raw as { phoneNumbers?: unknown; data?: unknown };
    if (Array.isArray(obj.phoneNumbers)) return obj.phoneNumbers as OrbitPhoneNumber[];
    if (Array.isArray(obj.data)) return obj.data as OrbitPhoneNumber[];
  }
  return [];
}

export async function GET() {
  try {
    const result = await orbitCoreRequest('GET', '/phone-number');
    return NextResponse.json(normalizePhoneNumbers(result));
  } catch (error: unknown) {
    const { toEburonError, eburonJsonResponse } = await import('@/lib/eburon');
    const eburonErr = toEburonError(error);
    console.error('[orbit/phone-numbers][GET]', { code: eburonErr.code, detail: eburonErr.detail });
    return NextResponse.json(...eburonJsonResponse(eburonErr));
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const areaCode = body?.areaCode || '415';
    const result = await orbitCoreRequest('POST', '/phone-number', {
      provider: 'vonage',
      name: `Auto-provisioned ${new Date().toISOString().slice(0, 10)}`,
      areaCode,
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const { toEburonError, eburonJsonResponse } = await import('@/lib/eburon');
    const eburonErr = toEburonError(error);
    console.error('[orbit/phone-numbers]', { code: eburonErr.code, detail: eburonErr.detail });
    return NextResponse.json(...eburonJsonResponse(eburonErr));
  }
}
