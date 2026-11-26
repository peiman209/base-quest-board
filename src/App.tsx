
import { useEffect, useState } from "react";

type Quest = {
  id: string;
  title: string;
  description: string;
  points: number;
  icon: string;
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

type SavedState = {
  points: number;
  streak: number;
  claimed: string[];
  lastClaimDate: string;
};

const STORAGE_KEY = "base-quest-board-v1";

function getToday() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function App() {
  const [saved, setSaved] = useState<SavedState>(() => {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value
        ? JSON.parse(value)
        : { points: 0, streak: 0, claimed: [], lastClaimDate: "" };
    } catch {
      return { points: 0, streak: 0, claimed: [], lastClaimDate: "" };
    }
  });

  const [wallet, setWallet] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [saved]);

  function claimQuest(quest: Quest) {
    if (saved.claimed.includes(quest.id)) return;

    const date = getToday();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const yesterdayKey = [
      yesterday.getFullYear(),
      String(yesterday.getMonth() + 1).padStart(2, "0"),
      String(yesterday.getDate()).padStart(2, "0"),
    ].join("-");

    const newStreak =
      saved.lastClaimDate === date
        ? saved.streak
        : saved.lastClaimDate === yesterdayKey
          ? saved.streak + 1
          : 1;

    setSaved({
      points: saved.points + quest.points,
      streak: newStreak,
      claimed: [...saved.claimed, quest.id],
      lastClaimDate: date,
    });
  }

  async function connectWallet() {
    const ethereum = (window as any).ethereum;

    if (!ethereum) {
      alert("Please install Rabby Wallet or MetaMask first.");
      return;
    }

    try {
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts?.length) {
        setWallet(accounts[0]);
      }
    } catch {
      alert("Wallet connection was cancelled.");
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
          <strong>{saved.points.toLocaleString()}</strong>
          <small>Your earned points</small>
        </div>

        <div className="stat-card">
          <span>Current Streak</span>
          <strong>🔥 {saved.streak} days</strong>
          <small>Keep showing up</small>
        </div>

        <div className="stat-card">
          <span>Completed Today</span>
          <strong>{saved.claimed.length}/{quests.length}</strong>
          <small>Daily missions</small>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">DAILY MISSIONS</span>
            <h2>Today's Quests</h2>
          </div>
          <span className="date-label">{new Date().toDateString()}</span>
        </div>

        <div className="quest-grid">
          {quests.map((quest) => {
            const isClaimed = saved.claimed.includes(quest.id);

            return (
              <article className="quest-card" key={quest.id}>
                <div className="quest-top">
                  <span className="quest-icon">{quest.icon}</span>
                  <span className="points">+{quest.points} PTS</span>
                </div>

                <h3>{quest.title}</h3>
                <p>{quest.description}</p>

                <button
                  className={isClaimed ? "claim-button claimed" : "claim-button"}
                  disabled={isClaimed}
                  onClick={() => claimQuest(quest)}
                >
                  {isClaimed ? "✓ Completed" : "Claim Reward"}
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
            The community leaderboard will become available when shared
            user data is connected.
          </p>
        </div>

        <div className="leaderboard-placeholder">
          <span>🏆</span>
          <strong>Coming Soon</strong>
          <small>Be among the first explorers.</small>
        </div>
      </section>

      <footer>
        Built for the Base community · Not affiliated with Coinbase
      </footer>
    </main>
  );
}

export default App;
