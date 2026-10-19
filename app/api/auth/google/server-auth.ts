import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';

const FIREBASE_API_KEY = 'AIzaSyBXvQPqJDXZohK03S2CeXt8ULkyAYbHiD4';
const AUTHORIZED_EMAILS = new Set([
  'joelruizpetit@gmail.com',
  'aijg1985@gmail.com'
]);

export interface FirebaseCalendarUser {
  uid: string;
  email: string;
}

interface SignedOAuthState {
  uid: string;
  email: string;
  createdAt: number;
  nonce: string;
}

export const GOOGLE_OAUTH_STATE_COOKIE = 'gcal_oauth_state';

export function googleRefreshCookieName(uid: string): string {
  return `gcal_refresh_${uid}`;
}

function isSecureRequest(request: NextRequest): boolean {
  return process.env.NODE_ENV === 'production' || request.nextUrl.protocol === 'https:';
}

export async function getAuthorizedFirebaseUser(request: NextRequest): Promise<FirebaseCalendarUser | null> {
  const authorization = request.headers.get('authorization') || '';
  const idToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!idToken) return null;

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        cache: 'no-store'
      }
    );
    if (!response.ok) return null;

    const data = await response.json() as { users?: Array<{ localId?: string; email?: string }> };
    const user = data.users?.[0];
    const uid = user?.localId;
    const email = user?.email?.toLowerCase();
    if (!uid || !email || !AUTHORIZED_EMAILS.has(email)) return null;
    return { uid, email };
  } catch (error) {
    console.error('No se pudo verificar la sesión de Firebase para Google Calendar:', error);
    return null;
  }
}

export function getGoogleOAuthConfig(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    new URL('/api/auth/google/callback', request.url).toString();
  const stateSecret = process.env.GOOGLE_OAUTH_STATE_SECRET || clientSecret;

  if (!clientId || !clientSecret || !stateSecret) return null;
  return { clientId, clientSecret, redirectUri, stateSecret };
}

export function createSignedOAuthState(user: FirebaseCalendarUser, secret: string): string {
  const state: SignedOAuthState = {
    uid: user.uid,
    email: user.email,
    createdAt: Date.now(),
    nonce: randomBytes(18).toString('base64url')
  };
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifySignedOAuthState(value: string, secret: string): SignedOAuthState | null {
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) return null;

  const expected = createHmac('sha256', secret).update(payload).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const state = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SignedOAuthState;
    const age = Date.now() - state.createdAt;
    if (!state.uid || !state.email || age < 0 || age > 10 * 60 * 1000) return null;
    if (!AUTHORIZED_EMAILS.has(state.email.toLowerCase())) return null;
    return state;
  } catch {
    return null;
  }
}

export function cookieOptions(request: NextRequest, maxAge: number) {
  return {
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: 'lax' as const,
    path: '/api/auth/google',
    maxAge
  };
}
