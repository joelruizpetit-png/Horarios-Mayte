This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### Google Calendar OAuth

Google Calendar uses a server-side OAuth flow. Its renewable permission is kept in an `HttpOnly` cookie tied to the Firebase user. Configure these Vercel environment variables:

- `GOOGLE_CLIENT_ID`: OAuth client ID for a Web application.
- `GOOGLE_CLIENT_SECRET`: secret for that same OAuth client; it is used only on the server.
- `GOOGLE_OAUTH_REDIRECT_URI`: exact URL `https://<production-domain>/api/auth/google/callback`.
- `GOOGLE_OAUTH_STATE_SECRET`: a long, randomly generated secret used to sign OAuth state.

Add that exact URL to **Authorized redirect URIs** for the OAuth client in Google Cloud Console. For local development, authorize `http://localhost:3000/api/auth/google/callback` and set the same value in the local `GOOGLE_OAUTH_REDIRECT_URI`. Redeploy after changing Vercel environment variables.

Set the OAuth consent screen to **In production** for ongoing Calendar access. When an external OAuth app is left in **Testing**, Google expires refresh tokens for non-basic scopes such as Calendar after 7 days. See [Google's OAuth documentation](https://developers.google.com/identity/protocols/oauth2#expiration).
