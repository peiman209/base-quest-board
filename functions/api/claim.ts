
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

    const body = await request.json() as {
      questId?: string;
      proof?: string;
    };

    const questId = body.questId;
    const proof = typeof body.proof === "string"
      ? body.proof.trim()
      : "";

    if (
      typeof questId !== "string" ||
      !Object.prototype.hasOwnProperty.call(QUESTS, questId)
    ) {
      return Response.json(
        { error: "Invalid quest." },
        { status: 400 }
      );
    }

    if (!proof || proof.length > 1000) {
      return Response.json(
        { error: "Please provide valid proof (max 1000 characters)." },
        { status: 400 }
      );
    }

    const wallet = session.wallet_address;
    const points = QUESTS[questId];
    const claimDate = new Date().toISOString().slice(0, 10);

    await env.DB.prepare(
      `INSERT INTO quest_claims
       (wallet_address, quest_id, points, claim_date, status, proof)
       VALUES (?, ?, ?, ?, 'pending', ?)`
    )
      .bind(wallet, questId, points, claimDate, proof)
      .run();

    return Response.json({
      success: true,
      questId,
      status: "pending",
      message: "Your quest submission is waiting for review.",
    });

  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("unique")
    ) {
      return Response.json(
        { error: "You have already submitted this quest today." },
        { status: 409 }
      );
    }

    return Response.json(
      { error: "Could not submit quest." },
      { status: 500 }
    );
  }
};
