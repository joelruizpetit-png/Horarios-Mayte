import { NextRequest, NextResponse } from 'next/server';
import {
  cookieOptions,
  getGoogleOAuthConfig,
  googleRefreshCookieName,
  GOOGLE_OAUTH_STATE_COOKIE,
  verifySignedOAuthState
} from '../server-auth';

export const runtime = 'nodejs';

function redirectWithError(request: NextRequest, message: string) {
  const destination = new URL('/', request.url);
  destination.hash = new URLSearchParams({ gcal_error: message }).toString();
  const response = NextResponse.redirect(destination);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', cookieOptions(request, 0));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(request: NextRequest) {
  const config = getGoogleOAuthConfig(request);
  if (!config) return redirectWithError(request, 'Falta configurar OAuth de Google en el servidor.');

  const url = new URL(request.url);
  const googleError = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  const stateFromGoogle = url.searchParams.get('state');
  const stateCookie = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  if (googleError) return redirectWithError(request, 'Se canceló la autorización de Google Calendar.');
  if (!code || !stateFromGoogle || !stateCookie || stateFromGoogle !== stateCookie) {
    return redirectWithError(request, 'No se pudo validar la autorización de Google. Vuelve a intentarlo.');
  }

  const state = verifySignedOAuthState(stateFromGoogle, config.stateSecret);
  if (!state) return redirectWithError(request, 'La autorización ha caducado. Vuelve a conectar Google Calendar.');

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code'
      }).toString(),
      cache: 'no-store'
    });
    const tokenData = await tokenResponse.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error_description?: string;
    };
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Error intercambiando el código OAuth de Google:', tokenData.error_description || tokenResponse.status);
      return redirectWithError(request, 'Google no pudo completar la conexión. Vuelve a intentarlo.');
    }

    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      cache: 'no-store'
    });
    const profile = await profileResponse.json() as { email?: string; verified_email?: boolean };
    if (!profileResponse.ok || !profile.email || profile.verified_email !== true || profile.email.toLowerCase() !== state.email.toLowerCase()) {
      return redirectWithError(request, `Conecta Google con la misma cuenta de la aplicación (${state.email}).`);
    }

    const refreshToken = tokenData.refresh_token ||
      request.cookies.get(googleRefreshCookieName(state.uid))?.value;
    if (!refreshToken) {
      return redirectWithError(request, 'Google no entregó permiso de renovación. Revoca el acceso de la app en tu cuenta de Google y vuelve a conectar.');
    }

    const destination = new URL('/', request.url);
    destination.hash = new URLSearchParams({
      gcal_connected: '1',
      access_token: tokenData.access_token,
      expires_in: String(tokenData.expires_in || 3600)
    }).toString();
    const response = NextResponse.redirect(destination);
    response.cookies.set(
      googleRefreshCookieName(state.uid),
      refreshToken,
      { ...cookieOptions(request, 60 * 60 * 24 * 180), path: '/' }
    );
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', cookieOptions(request, 0));
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    console.error('Error en callback OAuth de Google Calendar:', error);
    return redirectWithError(request, 'No se pudo completar la conexión. Comprueba la red y vuelve a intentarlo.');
  }
}
