
interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const result = await env.DB.prepare(
      `SELECT
         wallet_address,
         total_points
       FROM users
       WHERE total_points > 0
       ORDER BY total_points DESC, created_at ASC
       LIMIT 100`
    ).all<{
      wallet_address: string;
      total_points: number;
    }>();

    const leaderboard = (result.results || []).map((user, index) => ({
      rank: index + 1,
      wallet: user.wallet_address,
      points: user.total_points,
    }));

    return Response.json({
      success: true,
      leaderboard,
    });

  } catch {
    return Response.json(
      { error: "Could not load leaderboard." },
      { status: 500 }
    );
  }
};
