
interface Env {
  DB: D1Database;
}

const QUESTS: Record<string, number> = {
  gm: 10,
  explore: 25,
  daily: 40,
  community: 50,
};

export const onRequestPost: PagesFunction<Env> = async ({
  request,
  env,
}) => {
  const origin = request.headers.get("Origin");
  const requestOrigin = new URL(request.url).origin;

  if (!origin || origin !== requestOrigin) {
    return Response.json(
      { error: "Unauthorized origin." },
      { status: 403 }
    );
  }

  try {
    // 1. Validate session cookie
    const cookie = request.headers.get("Cookie") || "";
    const match = cookie.match(
      /(?:^|;\s*)__Host-bqb_session=([a-f0-9]{64})(?:;|$)/
    );

    if (!match) {
      return Response.json(
        { error: "Please connect your wallet first." },
        { status: 401 }
      );
    }

    const token = match[1];

    // 2. Verify session in database
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
        { error: "Session expired. Please reconnect your wallet." },
        { status: 401 }
      );
    }

    // 3. Validate quest ID
    const body = await request.json() as {
      questId?: string;
    };

    const questId = body.questId;

    if (
      typeof questId !== "string" ||
      !Object.prototype.hasOwnProperty.call(QUESTS, questId)
    ) {
      return Response.json(
        { error: "Invalid quest." },
        { status: 400 }
      );
    }

    const wallet = session.wallet_address;
    const points = QUESTS[questId];

    // Use UTC date consistently
    const claimDate = new Date().toISOString().slice(0, 10);

    // 4. Atomically claim quest and update points
    const results = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO quest_claims
         (wallet_address, quest_id, points, claim_date)
         VALUES (?, ?, ?, ?)`
      ).bind(wallet, questId, points, claimDate),

      env.DB.prepare(
        `UPDATE users
         SET total_points = total_points + ?
         WHERE wallet_address = ?`
      ).bind(points, wallet),
    ]);

    // 5. Confirm both operations succeeded
    if (
      results[0].meta.changes !== 1 ||
      results[1].meta.changes !== 1
    ) {
      return Response.json(
        { error: "Quest could not be claimed." },
        { status: 409 }
      );
    }

    // 6. Return updated total
    const user = await env.DB.prepare(
      `SELECT total_points
       FROM users
       WHERE wallet_address = ?`
    )
      .bind(wallet)
      .first<{ total_points: number }>();

    return Response.json({
      success: true,
      questId,
      points,
      totalPoints: user?.total_points ?? points,
    });

  } catch (error) {
    // Unique constraint means this quest was already claimed today
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("unique")
    ) {
      return Response.json(
        { error: "Quest already completed today." },
        { status: 409 }
      );
    }

    return Response.json(
      { error: "Could not claim quest." },
      { status: 500 }
    );
  }
};
