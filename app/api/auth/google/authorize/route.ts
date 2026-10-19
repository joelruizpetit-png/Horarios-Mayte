import { NextRequest, NextResponse } from 'next/server';
import {
  cookieOptions,
  createSignedOAuthState,
  getAuthorizedFirebaseUser,
  getGoogleOAuthConfig,
  GOOGLE_OAUTH_STATE_COOKIE
} from '../server-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const user = await getAuthorizedFirebaseUser(request);
  if (!user) {
    return NextResponse.json({ error: 'La sesión no es válida para conectar Google Calendar.' }, { status: 401 });
  }

  const config = getGoogleOAuthConfig(request);
  if (!config) {
    return NextResponse.json(
      { error: 'Falta configurar GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el servidor.' },
      { status: 500 }
    );
  }

  const state = createSignedOAuthState(user, config.stateSecret);
  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizationUrl.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    login_hint: user.email,
    state
  }).toString();

  const response = NextResponse.json({ authorizationUrl: authorizationUrl.toString() });
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, cookieOptions(request, 10 * 60));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
