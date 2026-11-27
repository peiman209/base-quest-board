
import { verifyMessage } from "ethers";

interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get("Origin");
  const requestOrigin = new URL(request.url).origin;

  if (!origin || origin !== requestOrigin) {
    return Response.json(
      { error: "Unauthorized origin." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json() as {
      wallet?: string;
      signature?: string;
    };

    const wallet = body.wallet?.toLowerCase();
    const signature = body.signature;

    if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet) || !signature) {
      return Response.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    const nonceRow = await env.DB.prepare(
      `SELECT nonce FROM nonces
       WHERE wallet_address = ?
       AND created_at >= datetime('now', '-5 minutes')
       ORDER BY created_at DESC LIMIT 1`
    )
      .bind(wallet)
      .first<{ nonce: string }>();

    if (!nonceRow) {
      return Response.json(
        { error: "Nonce not found or expired" },
        { status: 401 }
      );
    }

    const message =
      `Sign in to Base Quest Board\n` +
      `Wallet: ${wallet}\n` +
      `Nonce: ${nonceRow.nonce}`;

    const recovered = verifyMessage(message, signature).toLowerCase();

    if (recovered !== wallet) {
      return Response.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const consumed = await env.DB.prepare(
      `DELETE FROM nonces
       WHERE nonce = ?
       AND wallet_address = ?
       AND created_at >= datetime('now', '-5 minutes')`
    )
      .bind(nonceRow.nonce, wallet)
      .run();

    if (consumed.meta.changes !== 1) {
      return Response.json(
        { error: "Nonce already used or expired" },
        { status: 401 }
      );
    }

    await env.DB.prepare(
      "INSERT OR IGNORE INTO users (wallet_address) VALUES (?)"
    )
      .bind(wallet)
      .run();

    const randomBytes = crypto.getRandomValues(new Uint8Array(32));

    const token = Array.from(randomBytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    await env.DB.prepare(
      `INSERT INTO sessions (token, wallet_address, expires_at)
       VALUES (?, ?, datetime('now', '+7 days'))`
    )
      .bind(token, wallet)
      .run();

    const headers = new Headers();

    headers.set(
      "Set-Cookie",
      `__Host-bqb_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`
    );

    return Response.json(
      { success: true, wallet },
      { headers }
    );

  } catch (error) {
  return Response.json(
    {
      error: "Signature verification failed",
      details: error instanceof Error ? error.message : String(error),
    },
    { status: 401 }
  );
}
};
