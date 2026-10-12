import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { refreshToken, clientId: reqClientId, clientSecret: reqClientSecret } = body;

    if (!refreshToken) {
      return NextResponse.json(
        { exito: false, error: 'Falta refresh_token' },
        { status: 400 }
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || reqClientId;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || reqClientSecret;

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });

    if (clientId) {
      params.append('client_id', clientId);
    }
    if (clientSecret) {
      params.append('client_secret', clientSecret);
    }

    const googleRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await googleRes.json();

    if (googleRes.ok && data.access_token) {
      return NextResponse.json({
        exito: true,
        accessToken: data.access_token,
        expiresIn: data.expires_in || 3600
      });
    }

    return NextResponse.json(
      {
        exito: false,
        error: data.error_description || data.error || 'No se pudo renovar el token de Google Calendar',
        detalles: data
      },
      { status: googleRes.status || 400 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error interno al renovar token';
    return NextResponse.json(
      { exito: false, error: errorMsg },
      { status: 500 }
    );
  }
}
