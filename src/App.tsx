
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
  useEffect(() => {
  fetch("/api/me")
    .then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      if (data.authenticated && data.wallet) {
        setWallet(data.wallet);
      }
    })
    .catch(() => {});
}, []);

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

    const signature = await ethereum.request({
      method: "personal_sign",
      params: [message, accounts[0]],
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
      throw new Error(result.error || "Wallet verification failed.");
    }

    setWallet(walletAddress);
    alert("Wallet verified successfully!");
  } catch (error: any) {
    alert(error.message || "Wallet connection or verification failed.");
  }
}
