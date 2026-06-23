import { NextResponse } from 'next/server';

// Web call endpoint requires the Public API Key, not the Private Key
const WEB_CALL_KEY =
  process.env.NEXT_PUBLIC_ORBIT_TOKEN ||
  process.env.VAPI_PRIVATE_API_KEY ||
  process.env.ORBIT_SECRET ||
  process.env.VAPI_API_KEY ||
  '';

export async function POST(req: Request) {
  try {
    const { assistantId } = await req.json();
    
    if (!WEB_CALL_KEY) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }
    
    if (!assistantId) {
      return NextResponse.json({ error: 'Assistant ID required' }, { status: 400 });
    }

    // Proxy the web call request to VAPI using the Public API Key
    const res = await fetch('https://api.vapi.ai/call/web', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WEB_CALL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ assistantId }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: 'Web call failed', details: errorText },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[orbit/web-call] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
