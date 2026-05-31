import { useState, useEffect, useRef, useCallback } from "react";
import { ToastContainer } from "react-toastify";
import DraftControls from "./components/DraftControls";
import TeamPanel from "./components/TeamPanel";
import PickLog from "./components/PickLog";
import HumanPickBar from "./components/HumanPickBar";
import { showDraftError, showError } from "./toast";
import { usePlayerStats } from "./hooks/usePlayerStats";
import { createDefaultScoringConfig } from "./engine/fantasyScoring.js";
import "react-toastify/dist/ReactToastify.css";

const AI_COLORS = {
  Claude: { accent: "var(--claude-accent)", bg: "var(--claude-bg)" },
  ChatGPT: { accent: "var(--chatgpt-accent)", bg: "var(--chatgpt-bg)" },
  Gemini: { accent: "var(--gemini-accent)", bg: "var(--gemini-bg)" },
  Grok: { accent: "var(--grok-accent)", bg: "var(--grok-bg)" },
  Human: { accent: "var(--accent-primary)", bg: "var(--accent-primary-bg)" },
};

function getCurrentRound(picks, humanTurn, draftOrderLength) {
  if (humanTurn?.round) return humanTurn.round;
  if (picks.length === 0) return 1;
  const last = picks[picks.length - 1];
  if (last.nextPick?.round) return last.nextPick.round;
  if (last.round) return last.round;
  return Math.ceil(picks.length / Math.max(draftOrderLength, 1));
}

function getOnClockId(picks, humanTurn, draftOrder) {
  if (humanTurn?.participantId) return humanTurn.participantId;
  if (picks.length > 0) {
    return picks[picks.length - 1].nextPick?.participantId ?? null;
  }
  return draftOrder[0] ?? null;
}

function getDesktopGridColumns(pickerCount) {
  if (pickerCount <= 1) return 1;
  if (pickerCount % 2 === 0) return 2;
  return Math.min(pickerCount, 3);
}

function App() {
  const [status, setStatus] = useState("idle");
  const [draftOrder, setDraftOrder] = useState([]);
  const [league, setLeague] = useState(null);
  const [rounds, setRounds] = useState(10);
  const [picks, setPicks] = useState([]);
  const [teams, setTeams] = useState({});
  const [participantsMeta, setParticipantsMeta] = useState([]);
  const [fantasyScoring, setFantasyScoring] = useState(null);
  const [customRules, setCustomRules] = useState("");
  const [humanTurn, setHumanTurn] = useState(null);
  const eventSourceRef = useRef(null);

  const {
    resolveRoster,
    resolvePlayer,
    loading: statsLoading,
    season: statsSeason,
  } = usePlayerStats(league, fantasyScoring);

  const [theme, setTheme] = useState(
    () => localStorage.getItem("vibe-theme") || "system",
  );
  const [isDark, setIsDark] = useState(true);

  const draftOrderRef = useRef([]);
  const roundsRef = useRef(10);
  const statusRef = useRef("idle");

  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    if (status !== "idle") return;
    window.scrollTo(0, 0);
    document.querySelector(".app > .main-panel")?.scrollTo(0, 0);
  }, [status]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    draftOrderRef.current = draftOrder;
  }, [draftOrder]);

  useEffect(() => {
    roundsRef.current = rounds;
  }, [rounds]);

  useEffect(() => {
    const handleThemeChange = () => {
      const activeTheme = localStorage.getItem("vibe-theme") || "system";
      let resolvedDark = activeTheme === "dark";
      if (activeTheme === "system") {
        resolvedDark = window.matchMedia(
          "(prefers-color-scheme: dark)",
        ).matches;
      }
      setIsDark(resolvedDark);
      document.documentElement.classList.toggle("light", !resolvedDark);
      document.documentElement.classList.toggle("dark", resolvedDark);
      document.documentElement.style.colorScheme = resolvedDark
        ? "dark"
        : "light";
    };

    handleThemeChange();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", handleThemeChange);
    return () => mediaQuery.removeEventListener("change", handleThemeChange);
  }, [theme]);

  const selectTheme = (newTheme) => {
    localStorage.setItem("vibe-theme", newTheme);
    setTheme(newTheme);
  };

  const applyDraftState = useCallback((state) => {
    if (!state?.active) return;

    if (state.started) {
      draftOrderRef.current = state.started.draftOrder;
      roundsRef.current = state.started.rounds;
      setDraftOrder(state.started.draftOrder);
      setLeague(state.started.league);
      setRounds(state.started.rounds);
      if (state.started.participants) {
        setParticipantsMeta(state.started.participants);
      }
      if (state.started.fantasyScoring) {
        setFantasyScoring(state.started.fantasyScoring);
      } else if (state.started.league) {
        setFantasyScoring(createDefaultScoringConfig(state.started.league));
      }
      setCustomRules(state.started.customRules || "");
      setStatus("running");
    }

    if (state.picks?.length) {
      setPicks(state.picks);
      const teamsFromPicks = {};
      state.picks.forEach((pick) => {
        const key = pick.participantId || pick.aiName;
        teamsFromPicks[key] = pick.rosterSoFar || [];
      });
      setTeams((prev) => ({ ...prev, ...teamsFromPicks }));
    }

    if (state.humanTurn) {
      setHumanTurn(state.humanTurn);
    }
  }, []);

  const handleReset = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStatus("idle");
    setDraftOrder([]);
    setLeague(null);
    setPicks([]);
    setTeams({});
    setParticipantsMeta([]);
    setFantasyScoring(null);
    setCustomRules("");
    setHumanTurn(null);
  }, []);

  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource("/api/draft/stream");
    eventSourceRef.current = es;

    es.onopen = () => {
      fetch("/api/draft/state")
        .then((res) => (res.ok ? res.json() : null))
        .then((state) => {
          if (state) applyDraftState(state);
        })
        .catch(() => {});
    };

    es.addEventListener("started", (e) => {
      const data = JSON.parse(e.data);
      draftOrderRef.current = data.draftOrder;
      roundsRef.current = data.rounds;
      setDraftOrder(data.draftOrder);
      setLeague(data.league);
      setRounds(data.rounds);
      if (data.participants) setParticipantsMeta(data.participants);
      if (data.fantasyScoring) {
        setFantasyScoring(data.fantasyScoring);
      } else {
        setFantasyScoring(createDefaultScoringConfig(data.league));
      }
      setCustomRules(data.customRules || "");
      setStatus("running");
    });

    es.addEventListener("pick", (e) => {
      const data = JSON.parse(e.data);
      setPicks((prev) => {
        if (prev.some((p) => p.pick === data.pick)) return prev;
        return [...prev, data];
      });
      const rosterKey = data.participantId || data.aiName;
      setTeams((prev) => ({
        ...prev,
        [rosterKey]: Array.isArray(data.rosterSoFar) ? data.rosterSoFar : [],
      }));
      setHumanTurn((current) => (current?.pick === data.pick ? null : current));
    });

    es.addEventListener("humanTurn", (e) => {
      const data = JSON.parse(e.data);
      setHumanTurn(data);
    });

    es.addEventListener("complete", (e) => {
      const data = JSON.parse(e.data);
      setTeams(data.teams);
      setStatus("complete");
      es.close();
    });

    es.addEventListener("cancelled", () => {
      handleReset();
      es.close();
    });

    es.addEventListener("error", (e) => {
      try {
        const data = JSON.parse(e.data);
        showDraftError(data);
      } catch {
        showError("Connection lost");
      }
    });

    es.onerror = () => {
      if (statusRef.current === "running") {
        showError("Connection lost");
      }
    };

    return es;
  }, [applyDraftState, handleReset]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleCancelDraft = async () => {
    try {
      await fetch("/api/draft/cancel", { method: "POST" });
    } catch {
      // Return to setup even if the cancel request fails.
    }
    handleReset();
  };

  const handleHumanPick = async (player) => {
    const res = await fetch("/api/draft/human-pick", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ player }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.error || "Could not submit pick");
      err.code = data.code;
      throw err;
    }
  };

  const takenPlayers =
    humanTurn?.takenPlayers ?? picks.map((pick) => pick.player);

  const currentRound = getCurrentRound(picks, humanTurn, draftOrder.length);
  const snakeForward = currentRound % 2 === 1;
  const onClockId = getOnClockId(picks, humanTurn, draftOrder);

  const handleStart = async ({
    league: l,
    rounds: r,
    participants,
    draftOrder: manualDraftOrder,
    shuffleDraftOrder,
    apiKeys,
    fantasyScoring: scoring,
    customRules: draftCustomRules,
  }) => {
    setPicks([]);
    const initialTeams = {};
    participants.forEach((p) => {
      initialTeams[p.id] = [];
    });
    setTeams(initialTeams);
    setParticipantsMeta(participants);
    setFantasyScoring(scoring || createDefaultScoringConfig(l));
    setCustomRules(draftCustomRules || "");
    draftOrderRef.current = participants.map((p) => p.id);
    roundsRef.current = r;
    setDraftOrder(participants.map((p) => p.id));
    setLeague(l);
    setRounds(r);
    setStatus("starting");
    setHumanTurn(null);

    connectSSE();

    try {
      const body = {
        league: l,
        rounds: r,
        participants,
        draftOrder: manualDraftOrder,
        shuffleDraftOrder,
        apiKeys,
        fantasyScoring: scoring,
        customRules: draftCustomRules,
      };

      const res = await fetch("/api/draft/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        showError(data.error || "Failed to start draft");
        setStatus("idle");
        return;
      }

      setStatus("running");
    } catch {
      showError("Could not reach the draft server. Is it running?");
      setStatus("idle");
    }
  };

  return (
    <div
      className={`app${humanTurn ? " human-pick-open" : ""}${status === "complete" ? " draft-complete-open" : ""}`}
    >
      <header
        className={`app-header animate-fade${status === "idle" ? " app-header--landing" : " app-header--draft"}`}
      >
        <div className="app-header-inner">
          <div className="header-brand">
            <img
              src={isDark ? "/vd-light.png" : "/vd-dark.png"}
              alt="VibeDraftr"
              className="app-logo"
            />
            <div className="header-titles">
              <div className="header-title-row">
                <h1>VibeDraftr</h1>
                {status !== "idle" && league && (
                  <div className="header-badges">
                    <span className="league-badge">{league}</span>
                    {statsSeason && (
                      <span className="stats-season-badge">
                        {statsSeason} stats
                      </span>
                    )}
                  </div>
                )}
              </div>
              {status === "idle" && (
                <p className="subtitle-text">
                  AI Sports Fantasy Drafting. Good Vibes, Good Picks.
                </p>
              )}
            </div>
          </div>

          <div className="theme-switcher">
            <button
              type="button"
              className={theme === "light" ? "active" : ""}
              onClick={() => selectTheme("light")}
              title="Light Mode"
            >
              Light
            </button>
            <button
              type="button"
              className={theme === "dark" ? "active" : ""}
              onClick={() => selectTheme("dark")}
              title="Dark Mode"
            >
              Dark
            </button>
            <button
              type="button"
              className={theme === "system" ? "active" : ""}
              onClick={() => selectTheme("system")}
              title="System Preference"
            >
              System
            </button>
          </div>
        </div>
      </header>

      {status === "idle" ? (
        <div className="main-panel">
          <DraftControls onStart={handleStart} />
        </div>
      ) : (
        <div
          className={`draft-shell animate-in${humanTurn ? " human-pick-active" : ""}${status === "complete" ? " draft-complete" : ""}`}
        >
          <div className="app-body">
            <div className="main-panel">
              {draftOrder.length > 0 && (
                <div
                  className={`draft-board-header animate-fade${status === "complete" ? " draft-board-header--complete" : ""}`}
                >
                  <div className="draft-round-heading">
                    {status !== "complete" && (
                      <button
                        type="button"
                        className="draft-cancel-btn"
                        onClick={handleCancelDraft}
                        aria-label="Cancel draft"
                        title="Cancel draft"
                      >
                        ×
                      </button>
                    )}
                    <span className="draft-round-label">
                      {status === "complete"
                        ? "Draft Concluded"
                        : `Round ${currentRound} / ${rounds}`}
                    </span>
                  </div>
                  {status !== "complete" && (
                    <span
                      className="snake-direction"
                      title={
                        snakeForward
                          ? "Snake order: left to right this round"
                          : "Snake order: right to left this round"
                      }
                    >
                      <span className="snake-direction-label">
                        Snake Status
                      </span>
                      <span
                        className="snake-direction-arrow"
                        aria-hidden="true"
                      >
                        {snakeForward ? "→" : "←"}
                      </span>
                      <span className="snake-direction-text">
                        {snakeForward ? "Left → Right" : "Right → Left"}
                      </span>
                    </span>
                  )}
                  <span
                    className="pick-count"
                    aria-label={`${picks.length} picks`}
                  >
                    {picks.length}
                  </span>
                </div>
              )}
              <div
                className="teams-grid"
                data-columns={getDesktopGridColumns(draftOrder.length)}
              >
                {draftOrder.map((participantId, index) => {
                  const meta = participantsMeta.find(
                    (p) => p.id === participantId,
                  ) || {
                    id: participantId,
                    label: participantId,
                    model: participantId,
                  };
                  const roster = teams[participantId] || [];
                  const scored = resolveRoster(roster);
                  return (
                    <div
                      key={participantId}
                      className="animate-in"
                      style={{ animationDelay: `${0.05 + index * 0.07}s` }}
                    >
                      <TeamPanel
                        label={meta.label}
                        model={meta.model}
                        strategy={meta.strategy}
                        roster={roster}
                        rosterEntries={scored.entries}
                        fantasyTotal={scored.total}
                        league={league}
                        statsSeason={statsSeason}
                        statsLoading={statsLoading}
                        color={AI_COLORS[meta.model]}
                        pickSlot={index + 1}
                        isOnClock={participantId === onClockId}
                        isDraftComplete={status === "complete"}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div
              className="side-panel animate-slide"
              style={{ animationDelay: "0.12s" }}
            >
              <PickLog
                picks={picks}
                aiColors={AI_COLORS}
                league={league}
                statsSeason={statsSeason}
                resolvePlayer={resolvePlayer}
                reserveBottomSpace={
                  !!humanTurn && status !== "idle" && status !== "complete"
                }
              />
            </div>
          </div>
        </div>
      )}

      {humanTurn && status !== "idle" && status !== "complete" && (
        <div className="draft-viewport-sticky draft-viewport-sticky--human">
          <div className="draft-viewport-sticky-inner">
            <HumanPickBar
              humanTurn={humanTurn}
              takenPlayers={takenPlayers}
              customRules={customRules}
              onSubmit={handleHumanPick}
            />
          </div>
        </div>
      )}

      {status === "complete" && (
        <div className="draft-viewport-sticky draft-viewport-sticky--reset">
          <div className="draft-viewport-sticky-inner draft-viewport-sticky-inner--center">
            <button
              type="button"
              className="draft-reset-fab animate-in"
              onClick={handleReset}
            >
              New Draft
            </button>
          </div>
        </div>
      )}

      <ToastContainer
        position="bottom-center"
        theme={isDark ? "dark" : "light"}
        hideProgressBar
        closeOnClick
        pauseOnHover
        limit={3}
        toastClassName="draft-toast"
      />
    </div>
  );
}

export default App;
