export const dynamic = 'force-dynamic';

/**
 * ChatGPT app domain verification: the platform asks for its challenge token as plain text at
 * this path. Set OPENAI_APPS_CHALLENGE_TOKEN in the web environment to the token it shows.
 */
export async function GET() {
  const token = process.env.OPENAI_APPS_CHALLENGE_TOKEN?.trim();
  if (!token) return new Response('Not configured', { status: 404 });
  return new Response(token, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
