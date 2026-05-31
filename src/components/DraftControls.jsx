import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AI_LOGOS } from "./uiHelpers";
import ApiCredentialsSetup from "./ApiCredentialsSetup";
import {
  AI_LIST,
  HUMAN_MODEL,
  loadStoredApiKeys,
  saveApiKey,
  aiHasKey,
  needsCredentialsStep,
} from "../config/aiKeys";
import {
  buildDefaultParticipants,
  createParticipant,
  relabelParticipants,
} from "../config/participants";
import AdvancedScoringOptions from "./AdvancedScoringOptions";
import { createDefaultScoringConfig } from "../engine/fantasyScoring.js";

const AI_COLORS = {
  Claude: "var(--claude-accent)",
  ChatGPT: "var(--chatgpt-accent)",
  Gemini: "var(--gemini-accent)",
  Grok: "var(--grok-accent)",
  Human: "var(--accent-primary)",
};

function ParticipantCardContent({
  participant,
  index,
  shuffleOrder,
  showStrategy = true,
  readOnly = false,
  onRemove,
  onStrategyChange,
  onHumanLabelChange,
  canRemove,
}) {
  const p = participant;

  return (
    <>
      <div className="participant-card-header">
        <div className="participant-card-identity">
          {!shuffleOrder && (
            <span className="participant-order-num" aria-hidden="true">
              {index + 1}
            </span>
          )}
          <div
            className="checkbox-ai-logo"
            style={{ color: AI_COLORS[p.model] }}
          >
            {AI_LOGOS[p.model]}
          </div>
          {p.model === HUMAN_MODEL ? (
            readOnly ? (
              <span className="participant-name">{p.label}</span>
            ) : (
              <input
                type="text"
                className="participant-name-input"
                placeholder="Name this drafter"
                value={p.label}
                onChange={(e) => onHumanLabelChange(p.id, e.target.value)}
                aria-label={`Name for ${p.label}`}
              />
            )
          ) : (
            <span className="participant-name">{p.label}</span>
          )}
        </div>
        {!readOnly && (
          <button
            type="button"
            className="participant-remove"
            onClick={() => onRemove(p.id)}
            disabled={!canRemove}
            title={!canRemove ? "Need at least 2 participants" : "Remove"}
            aria-label={`Remove ${p.label}`}
          >
            ×
          </button>
        )}
      </div>
      {showStrategy && p.model !== HUMAN_MODEL && (
        readOnly ? (
          p.strategy ? (
            <p className="participant-strategy-preview">{p.strategy}</p>
          ) : null
        ) : (
          <input
            type="text"
            placeholder={`Strategy for ${p.label} (optional)`}
            value={p.strategy}
            onChange={(e) => onStrategyChange(p.id, e.target.value)}
          />
        )
      )}
    </>
  );
}

function DraftControls({ onStart }) {
  const [setupStep, setSetupStep] = useState("loading");
  const [league, setLeague] = useState("NBA");
  const [rounds, setRounds] = useState(10);
  const [participants, setParticipants] = useState([]);
  const [shuffleOrder, setShuffleOrder] = useState(true);
  const listRef = useRef(null);
  const lineRef = useRef(null);
  const previewRef = useRef(null);
  const dragFromRef = useRef(null);
  const dropAtRef = useRef(null);
  const dragMetaRef = useRef(null);
  const [liftedSlot, setLiftedSlot] = useState(null);
  const [fantasyScoring, setFantasyScoring] = useState(() =>
    createDefaultScoringConfig("NBA"),
  );
  const [customRules, setCustomRules] = useState("");

  const [apiKeys, setApiKeys] = useState(loadStoredApiKeys);

  const [envKeys, setEnvKeys] = useState({
    ANTHROPIC_API_KEY: false,
    OPENAI_API_KEY: false,
    GOOGLE_API_KEY: false,
    XAI_API_KEY: false,
  });

  useEffect(() => {
    if (setupStep === "loading") return;
    window.scrollTo(0, 0);
    document.querySelector(".app > .main-panel")?.scrollTo(0, 0);
  }, [setupStep]);

  useEffect(() => {
    document
      .querySelectorAll("body > .participant-card-lifted")
      .forEach((el) => el.remove());
    document.body.classList.remove("participant-reorder-active");

    return () => {
      document.body.classList.remove("participant-reorder-active");
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadEnvKeys = async (attempt = 0) => {
      try {
        const res = await fetch("/api/env-keys");
        if (!res.ok) throw new Error("Status check failed");
        const data = await res.json();
        if (cancelled) return;

        const nextEnvKeys = {
          ANTHROPIC_API_KEY: !!data.ANTHROPIC_API_KEY,
          OPENAI_API_KEY: !!data.OPENAI_API_KEY,
          GOOGLE_API_KEY: !!data.GOOGLE_API_KEY,
          XAI_API_KEY: !!data.XAI_API_KEY,
        };
        setEnvKeys(nextEnvKeys);
        const step = needsCredentialsStep(nextEnvKeys)
          ? "credentials"
          : "draft";
        setSetupStep(step);
        if (step === "draft") {
          setParticipants(
            buildDefaultParticipants(nextEnvKeys, loadStoredApiKeys()),
          );
        }
      } catch (err) {
        if (cancelled) return;
        if (attempt < 10) {
          await new Promise((resolve) => setTimeout(resolve, 400));
          return loadEnvKeys(attempt + 1);
        }
        console.warn("Could not fetch server-side API key configuration:", err);
        setSetupStep("credentials");
      }
    };

    loadEnvKeys();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleApiKeyChange = (key, value) => {
    setApiKeys((prev) => {
      const updated = { ...prev, [key]: value };
      saveApiKey(key, value);
      return updated;
    });
  };

  const removeParticipant = (id) => {
    if (participants.length <= 2) return;
    setParticipants((prev) => relabelParticipants(prev.filter((p) => p.id !== id)));
  };

  const addParticipant = (model) => {
    if (model !== HUMAN_MODEL && !aiHasKey(model, envKeys, apiKeys)) return;
    setParticipants((prev) => [...prev, createParticipant(model, prev)]);
  };

  const updateStrategy = (id, strategy) => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, strategy } : p)),
    );
  };

  const updateHumanLabel = (id, label) => {
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              label,
              customLabel: true,
            }
          : p,
      ),
    );
  };

  const insertParticipant = (fromIndex, insertAt) => {
    if (fromIndex === insertAt || fromIndex + 1 === insertAt) return;
    setParticipants((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      let target = insertAt;
      if (fromIndex < target) target -= 1;
      next.splice(target, 0, moved);
      return next;
    });
  };

  const getInsertIndex = (listElement, clientY) => {
    const cards = listElement.querySelectorAll(".participant-card");
    if (!cards.length) return 0;

    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (clientY < midpoint) return i;
    }

    return cards.length;
  };

  const updateDropLine = () => {
    const list = listRef.current;
    const line = lineRef.current;
    const from = dragFromRef.current;
    const at = dropAtRef.current;
    if (!list || !line || from == null || at == null) return;

    if (at === from || at === from + 1) {
      line.style.opacity = "0";
      return;
    }

    const cards = list.querySelectorAll(".participant-card");
    if (!cards.length) {
      line.style.opacity = "0";
      return;
    }

    const listRect = list.getBoundingClientRect();
    let top;
    if (at >= cards.length) {
      const lastRect = cards[cards.length - 1].getBoundingClientRect();
      top = lastRect.bottom - listRect.top + 6;
    } else {
      const cardRect = cards[at].getBoundingClientRect();
      top = cardRect.top - listRect.top - 6;
    }

    line.style.top = `${top}px`;
    line.style.opacity = "1";
  };

  const moveLiftedPreview = (clientX, clientY) => {
    const meta = dragMetaRef.current;
    const preview = previewRef.current;
    if (!meta || !preview) return;
    preview.style.left = `${clientX - meta.offsetX}px`;
    preview.style.top = `${clientY - meta.offsetY}px`;
  };

  const finishReorder = () => {
    const from = dragFromRef.current;
    const at = dropAtRef.current;
    dragMetaRef.current = null;
    dragFromRef.current = null;
    dropAtRef.current = null;
    setLiftedSlot(null);
    document.body.classList.remove("participant-reorder-active");
    if (lineRef.current) lineRef.current.style.opacity = "0";
    if (from != null && at != null) {
      insertParticipant(from, at);
    }
  };

  const handleReorderPointerDown = (index) => (e) => {
    if (shuffleOrder || e.button !== 0) return;
    if (e.target.closest("input, button, textarea, select, a")) return;

    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    dragMetaRef.current = {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };

    dragFromRef.current = index;
    dropAtRef.current = index;
    setLiftedSlot({
      index,
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
      pointerId: e.pointerId,
    });
    document.body.classList.add("participant-reorder-active");
    card.setPointerCapture(e.pointerId);

    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== e.pointerId) return;
      moveLiftedPreview(moveEvent.clientX, moveEvent.clientY);
      const list = listRef.current;
      if (!list) return;
      dropAtRef.current = getInsertIndex(list, moveEvent.clientY);
      updateDropLine();
    };

    const onEnd = (endEvent) => {
      if (endEvent.pointerId !== e.pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      if (card.hasPointerCapture(e.pointerId)) {
        card.releasePointerCapture(e.pointerId);
      }
      finishReorder();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);

    requestAnimationFrame(() => {
      moveLiftedPreview(e.clientX, e.clientY);
      updateDropLine();
    });
  };

  const handleLeagueChange = (nextLeague) => {
    setLeague(nextLeague);
    setFantasyScoring(createDefaultScoringConfig(nextLeague));
    setCustomRules("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (participants.length < 2) return;

    onStart({
      league,
      rounds,
      participants: participants.map(({ id, model, label, strategy }) => ({
        id,
        model,
        label: label.trim() || model,
        strategy: strategy.trim() || undefined,
      })),
      draftOrder: participants.map((p) => p.id),
      shuffleDraftOrder: shuffleOrder,
      fantasyScoring,
      customRules: customRules.trim() || undefined,
      apiKeys,
    });
  };

  const isSubmitDisabled = participants.length < 2;

  if (setupStep === "loading") {
    return (
      <div className="setup-dashboard single-column">
        <div className="setup-form focus-block step-enter animate-in">
          <div className="empty-state" style={{ minHeight: 200 }}>
            <span className="empty-text">Checking API configuration…</span>
          </div>
        </div>
      </div>
    );
  }

  if (setupStep === "credentials") {
    return (
      <ApiCredentialsSetup
        envKeys={envKeys}
        apiKeys={apiKeys}
        onApiKeyChange={handleApiKeyChange}
        onContinue={() => {
          setParticipants(buildDefaultParticipants(envKeys, apiKeys));
          setSetupStep("draft");
        }}
      />
    );
  }

  return (
    <div className="setup-dashboard single-column">
      <form
        onSubmit={handleSubmit}
        className="setup-form focus-block step-enter"
      >
        <div className="setup-section">
          <h2 className="animate-in">Draft Configuration</h2>
          <p className="setup-subtitle animate-in animate-delay-1">
            Add or remove drafters, set a strategy for each AI, and add multiple
            humans if needed.
          </p>

          <div className="field animate-in animate-delay-2">
            <label>League</label>
            <div className="toggle-group">
              <button
                type="button"
                className={league === "NBA" ? "active" : ""}
                onClick={() => handleLeagueChange("NBA")}
              >
                NBA
              </button>
              <button
                type="button"
                className={league === "NHL" ? "active" : ""}
                onClick={() => handleLeagueChange("NHL")}
              >
                NHL
              </button>
            </div>
          </div>

          <div className="field animate-in animate-delay-3">
            <label
              className={`shuffle-toggle${shuffleOrder ? " checked" : ""}`}
            >
              <span className="shuffle-toggle-text">Shuffle order</span>
              <input
                type="checkbox"
                checked={shuffleOrder}
                onChange={(e) => setShuffleOrder(e.target.checked)}
              />
              <span className="advanced-options-switch" aria-hidden="true" />
            </label>
          </div>

          <div className="field animate-in animate-delay-4">
            <label>Rounds</label>
            <input
              type="number"
              min={1}
              max={30}
              value={rounds}
              onChange={(e) =>
                setRounds(
                  Math.max(1, Math.min(30, parseInt(e.target.value) || 1)),
                )
              }
            />
          </div>

          <div className="field animate-in animate-delay-5">
            {!shuffleOrder && (
              <p className="field-hint">Drag participants to set pick order.</p>
            )}
            <label className="participant-list-label">
              Draft participants (at least 2)
            </label>
            <div ref={listRef} className="participant-list">
              <div
                ref={lineRef}
                className="participant-drop-line"
                aria-hidden="true"
              />
              {participants.map((p, index) => (
                <div
                  key={p.id}
                  className={`participant-card${p.model === HUMAN_MODEL ? " participant-card-human" : ""}${!shuffleOrder ? " participant-card-reorderable" : ""}${liftedSlot?.index === index ? " participant-card-source-hidden" : ""}`}
                  onPointerDown={
                    !shuffleOrder ? handleReorderPointerDown(index) : undefined
                  }
                >
                  <ParticipantCardContent
                    participant={p}
                    index={index}
                    shuffleOrder={shuffleOrder}
                    onRemove={removeParticipant}
                    onStrategyChange={updateStrategy}
                    onHumanLabelChange={updateHumanLabel}
                    canRemove={participants.length > 2}
                  />
                </div>
              ))}
            </div>
            {participants.length < 2 && (
              <span className="field-error">
                Add at least 2 participants to start a draft.
              </span>
            )}
          </div>

          <AdvancedScoringOptions
            league={league}
            value={fantasyScoring}
            onChange={setFantasyScoring}
            customRules={customRules}
            onCustomRulesChange={setCustomRules}
          />

          <div className="field animate-in animate-delay-7">
            <label>Add drafter</label>
            <div className="add-participant-buttons">
              {AI_LIST.map((model) => {
                const available = aiHasKey(model, envKeys, apiKeys);
                return (
                  <button
                    key={model}
                    type="button"
                    className="add-participant-btn"
                    disabled={!available}
                    onClick={() => addParticipant(model)}
                    title={
                      available
                        ? `Add ${model}`
                        : "No API key configured"
                    }
                  >
                    + {model}
                  </button>
                );
              })}
              <button
                type="button"
                className="add-participant-btn add-participant-btn-human"
                onClick={() => addParticipant(HUMAN_MODEL)}
                title="Add a human drafter"
              >
                + Human
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="btn-start animate-in animate-delay-8"
          disabled={isSubmitDisabled}
        >
          Start Draft
        </button>
      </form>
      {liftedSlot &&
        createPortal(
          <div
            ref={previewRef}
            className={`participant-card participant-card-lifted${
              participants[liftedSlot.index]?.model === HUMAN_MODEL
                ? " participant-card-human"
                : ""
            }`}
            style={{
              width: liftedSlot.width,
              left: liftedSlot.left,
              top: liftedSlot.top,
            }}
          >
            <ParticipantCardContent
              participant={participants[liftedSlot.index]}
              index={liftedSlot.index}
              shuffleOrder={shuffleOrder}
              readOnly
            />
          </div>,
          document.body,
        )}
    </div>
  );
}

export default DraftControls;
