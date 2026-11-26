interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const wallet = new URL(request.url).searchParams.get("wallet");

  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return Response.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  const nonce = crypto.randomUUID();

  await env.DB.prepare(
    "INSERT INTO nonces (wallet_address, nonce, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
  )
    .bind(wallet.toLowerCase(), nonce)
    .run();

  return Response.json({ nonce });
};
