
interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const cookie = request.headers.get("Cookie") || "";
    const match = cookie.match(/(?:^|;\s*)__Host-bqb_session=([a-f0-9]{64})(?:;|$)/);

    if (!match) {
      return Response.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    const token = match[1];

    const session = await env.DB.prepare(
      `SELECT wallet_address FROM sessions
       WHERE token = ?
       AND expires_at > datetime('now')
       LIMIT 1`
    )
      .bind(token)
      .first<{ wallet_address: string }>();

    if (!session) {
      return Response.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    return Response.json({
      authenticated: true,
      wallet: session.wallet_address,
    });

  } catch {
    return Response.json(
      { error: "Session check failed" },
      { status: 500 }
    );
  }
};
