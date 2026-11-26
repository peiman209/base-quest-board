import { verifyMessage } from "ethers";

interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json() as {
      wallet?: string;
      signature?: string;
    };

    const wallet = body.wallet?.toLowerCase();
    const signature = body.signature;

    if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet) || !signature) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const nonceRow = await env.DB.prepare(
      "SELECT nonce, created_at FROM nonces WHERE wallet_address = ? ORDER BY created_at DESC LIMIT 1"
    )
      .bind(wallet)
      .first<{ nonce: string; created_at: string }>();

    if (!nonceRow) {
      return Response.json({ error: "Nonce not found" }, { status: 401 });
    }

    const createdAt = new Date(nonceRow.created_at.replace(" ", "T") + "Z").getTime();

    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 5 * 60 * 1000) {
      await env.DB.prepare("DELETE FROM nonces WHERE wallet_address = ?")
        .bind(wallet)
        .run();

      return Response.json({ error: "Nonce expired" }, { status: 401 });
    }

    const message = `Sign in to Base Quest Board\nWallet: ${wallet}\nNonce: ${nonceRow.nonce}`;

    const recovered = verifyMessage(message, signature).toLowerCase();

    if (recovered !== wallet) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }

    const consumed = await env.DB.prepare(
  "DELETE FROM nonces WHERE nonce = ? AND wallet_address = ? AND created_at >= datetime('now', '-5 minutes')"
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

    return Response.json({ success: true, wallet });
  } catch {
    return Response.json({ error: "Signature verification failed" }, { status: 401 });
  }
};
