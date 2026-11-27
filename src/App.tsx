
import { useEffect, useState } from "react";
import { hexlify, toUtf8Bytes } from "ethers";

type Quest = {
  id: string;
  title: string;
  description: string;
  points: number;
  icon: string;
};

type LeaderboardEntry = {
  rank: number;
  wallet: string;
  points: number;
};

const quests: Quest[] = [
  {
    id: "gm",
    title: "Say GM",
    description: "Start your day by greeting the Base community.",
    points: 10,
    icon: "☀️",
  },
  {
    id: "explore",
    title: "Explore Base",
    description: "Discover a new project in the Base ecosystem.",
    points: 25,
    icon: "🔵",
  },
  {
    id: "daily",
    title: "Daily Explorer",
    description: "Explore something new on Base today.",
    points: 40,
    icon: "🧭",
  },
  {
    id: "community",
    title: "Community Builder",
    description: "Help someone in the Base community.",
    points: 50,
    icon: "🤝",
  },
];
async function getWalletProvider() {
  const win = window as any;

  const providers = [
    ...(win.ethereum?.providers || []),
    win.ethereum,
    win.rabby?.ethereum,
  ].filter(Boolean);

  // اولویت با Rabby
  const rabby = providers.find(
    (provider: any) => provider.isRabby
  );

  if (rabby) return rabby;

  // جست‌وجوی کیف پول از طریق EIP-6963
  let announcedProvider: any = null;

  const handler = (event: Event) => {
    const detail = (event as CustomEvent).detail;

    if (
      detail?.info?.rdns === "io.rabby" ||
      detail?.provider?.isRabby
    ) {
      announcedProvider = detail.provider;
    }
  };

  window.addEventListener(
    "eip6963:announceProvider",
    handler
  );

  window.dispatchEvent(
    new Event("eip6963:requestProvider")
  );

  await new Promise((resolve) => setTimeout(resolve, 300));

  window.removeEventListener(
    "eip6963:announceProvider",
    handler
  );

  return (
    announcedProvider ||
    providers.find((provider: any) => provider.request) ||
    null
  );
}
function App() {
  const [wallet, setWallet] = useState("");
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [claimed, setClaimed] = useState<string[]>([]);
  const [pending, setPending] = useState<string[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [claiming, setClaiming] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadProfile() {
    try {
      const response = await fetch("/api/me");
      if (!response.ok) {
        setWallet("");
        setPoints(0);
        setStreak(0);
        setClaimed([]);
        return;
      }

      const data = await response.json();

      if (data.authenticated) {
        setWallet(data.wallet || "");
        setPoints(data.points || 0);
        setStreak(data.streak || 0);
        setClaimed(data.claimed || []);
        setPending(data.pending || []);
      }
    } catch {
      console.error("Could not load profile.");
    }
  }

  async function loadLeaderboard() {
    try {
      const response = await fetch("/api/leaderboard");
      if (!response.ok) return;

      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
    } catch {
      console.error("Could not load leaderboard.");
    }
  }

  useEffect(() => {
    async function initialize() {
      await loadProfile();
      await loadLeaderboard();
      setLoading(false);
    }

    initialize();
  }, []);

 async function connectWallet() {
  try {
    const ethereum = await getWalletProvider();

    if (!ethereum) {
      alert("Please install or enable Rabby Wallet or MetaMask.");
      return;
    }
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!accounts?.length) return;

      const walletAddress = accounts[0].toLowerCase();

      const nonceResponse = await fetch(
        `/api/nonce?wallet=${walletAddress}`
      );

      if (!nonceResponse.ok) {
        throw new Error("Could not get sign-in nonce.");
      }

      const { nonce } = await nonceResponse.json();

      const message =
        `Sign in to Base Quest Board\n` +
        `Wallet: ${walletAddress}\n` +
        `Nonce: ${nonce}`;

      const hexMessage = hexlify(toUtf8Bytes(message));

const signature = await ethereum.request({
  method: "personal_sign",
  params: [hexMessage, accounts[0]],
});

      const verifyResponse = await fetch("/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wallet: walletAddress,
          signature,
        }),
      });

      const result = await verifyResponse.json();

      if (!verifyResponse.ok || !result.success) {
  throw new Error(
    `${result.error || "Wallet verification failed."} ${
      result.details || ""
    }`
  );
}

      await loadProfile();
      await loadLeaderboard();

      alert("Wallet verified successfully!");
    } catch (error: any) {
      alert(error.message || "Wallet connection or verification failed.");
    }
  }

  
async function claimQuest(quest: Quest) {
  if (!wallet) {
    alert("Please connect your wallet first.");
    return;
  }

  if (claimed.includes(quest.id) || pending.includes(quest.id) || claiming) return;

  const proof = window.prompt(
    "Paste the link or describe how you completed this quest:"
  );

  if (proof === null) return;

  if (!proof.trim() || proof.trim().length > 1000) {
    alert("Please enter valid proof (maximum 1000 characters).");
    return;
  }

  setClaiming(quest.id);

  try {
    const response = await fetch("/api/claim", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        questId: quest.id,
        proof: proof.trim(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not submit quest.");
    }

    setPending((previous) => [...previous, quest.id]);

    await loadProfile();

    alert("Your quest has been submitted for review. Points will be added after approval.");
  } catch (error: any) {
    alert(error.message || "Could not submit quest.");
  } finally {
    setClaiming("");
  }
}

  const shortWallet = wallet
    ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
    : "";

  return (
    <main className="app">
      <nav className="navbar">
        <div className="brand">
          <span className="brand-icon">🔵</span>
          <span>BASE QUEST BOARD</span>
        </div>

        <button className="wallet-button" onClick={connectWallet}>
          {wallet ? shortWallet : "Connect Wallet"}
        </button>
      </nav>

      <section className="hero">
        <div className="eyebrow">YOUR DAILY MISSION ON BASE</div>

        <h1>
          Explore. Complete.
          <br />
          <span>Earn Points.</span>
        </h1>

        <p>
          Complete daily quests, build your streak, and climb the Base
          community leaderboard.
        </p>
      </section>

      <section className="stats">
        <div className="stat-card">
          <span>Total Points</span>
          <strong>{points.toLocaleString()}</strong>
          <small>Your earned points</small>
        </div>

        <div className="stat-card">
          <span>Current Streak</span>
          <strong>🔥 {streak} days</strong>
          <small>Keep showing up</small>
        </div>

        <div className="stat-card">
          <span>Completed Today</span>
          <strong>{claimed.length}/{quests.length}</strong>
          <small>Daily missions</small>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">DAILY MISSIONS</span>
            <h2>Today's Quests</h2>
          </div>

          <span className="date-label">
            {new Date().toDateString()}
          </span>
        </div>

        <div className="quest-grid">
          {quests.map((quest) => {
            const isClaimed = claimed.includes(quest.id);
            const isClaiming = claiming === quest.id;
            const isPending = pending.includes(quest.id);

            return (
              <article className="quest-card" key={quest.id}>
                <div className="quest-top">
                  <span className="quest-icon">{quest.icon}</span>
                  <span className="points">+{quest.points} PTS</span>
                </div>

                <h3>{quest.title}</h3>
                <p>{quest.description}</p>

                
<button
  className={
    isClaimed
      ? "claim-button claimed"
      : isPending
        ? "claim-button pending"
        : "claim-button"
  }
  disabled={isClaimed || isPending || !!claiming || loading}
  onClick={() => claimQuest(quest)}
>
  {isClaimed
    ? "✓ Completed"
    : isPending
      ? "⏳ Pending Review"
      : isClaiming
        ? "Submitting..."
        : "Submit Quest"}
</button>

              </article>
            );
          })}
        </div>
      </section>

      <section className="section leaderboard">
        <div>
          <span className="eyebrow">COMMUNITY</span>
          <h2>Leaderboard</h2>
          <p>
            Explore the top members of the Base Quest Board community.
          </p>
        </div>

        <div className="leaderboard-placeholder">
          {loading ? (
            <p>Loading leaderboard...</p>
          ) : leaderboard.length === 0 ? (
            <>
              <span>🏆</span>
              <strong>No explorers yet</strong>
              <small>Be the first to earn points.</small>
            </>
          ) : (
            leaderboard.map((user) => (
              <div key={user.wallet}>
                <strong>#{user.rank}</strong>
                {" · "}
                {user.wallet.slice(0, 6)}...{user.wallet.slice(-4)}
                {" · "}
                {user.points.toLocaleString()} PTS
              </div>
            ))
          )}
        </div>
      </section>

      <footer>
        Built for the Base community · Not affiliated with Coinbase
      </footer>
    </main>
  );
}

export default App;
