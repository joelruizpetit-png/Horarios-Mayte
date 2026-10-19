import { NextRequest, NextResponse } from 'next/server';
import {
  cookieOptions,
  getAuthorizedFirebaseUser,
  getGoogleOAuthConfig,
  googleRefreshCookieName
} from '../server-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const user = await getAuthorizedFirebaseUser(request);
  if (!user) {
    return NextResponse.json({ exito: false, error: 'La sesión no es válida.' }, { status: 401 });
  }

  const refreshToken = request.cookies.get(googleRefreshCookieName(user.uid))?.value;
  if (!refreshToken) {
    return NextResponse.json(
      { exito: false, reconectar: true, error: 'No hay una conexión renovable de Google Calendar.' },
      { status: 401 }
    );
  }

  const config = getGoogleOAuthConfig(request);
  if (!config) {
    return NextResponse.json(
      { exito: false, error: 'Falta configurar OAuth de Google en el servidor.' },
      { status: 500 }
    );
  }

  try {
    const googleResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret
      }).toString(),
      cache: 'no-store'
    });
    const data = await googleResponse.json() as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (googleResponse.ok && data.access_token) {
      const response = NextResponse.json({
        exito: true,
        accessToken: data.access_token,
        expiresIn: data.expires_in || 3600
      });
      response.headers.set('Cache-Control', 'no-store');
      return response;
    }

    const invalidGrant = data.error === 'invalid_grant';
    const response = NextResponse.json(
      {
        exito: false,
        reconectar: invalidGrant,
        error: invalidGrant
          ? 'Google revocó el permiso de renovación.'
          : (data.error_description || data.error || 'Google no pudo renovar el acceso.')
      },
      { status: invalidGrant ? 401 : (googleResponse.status || 502) }
    );
    if (invalidGrant) {
      response.cookies.set(googleRefreshCookieName(user.uid), '', { ...cookieOptions(request, 0), path: '/' });
    }
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    console.error('Error renovando el token de Google Calendar:', error);
    return NextResponse.json(
      { exito: false, error: 'No se pudo conectar con Google para renovar el acceso.' },
      { status: 502 }
    );
  }
}
