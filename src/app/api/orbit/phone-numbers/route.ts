import { NextResponse } from 'next/server';
import { orbitCoreRequest } from '@/lib/services/orbit';

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
