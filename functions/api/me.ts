
interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const cookie = request.headers.get("Cookie") || "";
    const match = cookie.match(
      /(?:^|;\s*)__Host-bqb_session=([a-f0-9]{64})(?:;|$)/
    );

    if (!match) {
      return Response.json({ authenticated: false }, { status: 401 });
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
      return Response.json({ authenticated: false }, { status: 401 });
    }

    const wallet = session.wallet_address;
    const today = new Date().toISOString().slice(0, 10);

    const user = await env.DB.prepare(
      `SELECT total_points FROM users
       WHERE wallet_address = ?
       LIMIT 1`
    )
      .bind(wallet)
      .first<{ total_points: number }>();

    const todayClaims = await env.DB.prepare(
      `SELECT quest_id FROM quest_claims
       WHERE wallet_address = ?
       AND claim_date = ?
       AND status = 'approved'`
    )
      .bind(wallet, today)
      .all<{ quest_id: string }>();

    const todayPending = await env.DB.prepare(
      `SELECT quest_id FROM quest_claims
       WHERE wallet_address = ?
       AND claim_date = ?
       AND status = 'pending'`
    )
      .bind(wallet, today)
      .all<{ quest_id: string }>();

    const history = await env.DB.prepare(
      `SELECT DISTINCT claim_date FROM quest_claims
       WHERE wallet_address = ?
       AND status = 'approved'
       ORDER BY claim_date DESC
       LIMIT 400`
    )
      .bind(wallet)
      .all<{ claim_date: string }>();

    const claimDates = new Set(
      (history.results || []).map((item) => item.claim_date)
    );

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    let currentDate = claimDates.has(today)
      ? new Date(`${today}T00:00:00Z`)
      : yesterday;

    let streak = 0;

    while (claimDates.has(currentDate.toISOString().slice(0, 10))) {
      streak++;
      currentDate.setUTCDate(currentDate.getUTCDate() - 1);
    }

    return Response.json({
      authenticated: true,
      wallet,
      points: user?.total_points ?? 0,
      claimed: (todayClaims.results || []).map((item) => item.quest_id),
      pending: (todayPending.results || []).map((item) => item.quest_id),
      streak,
    });

  } catch {
    return Response.json(
      { error: "Session check failed" },
      { status: 500 }
    );
  }
};
