import { useState, useEffect, useRef } from "react";

function isTaken(player, takenPlayers) {
  const normalized = player.trim().toLowerCase();
  if (!normalized) return false;
  return takenPlayers.some((p) => p.toLowerCase() === normalized);
}

function HumanPickBar({ humanTurn, takenPlayers, customRules, onSubmit }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [alert, setAlert] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (humanTurn) {
      setName("");
      setError("");
      setAlert("");
      setSubmitting(false);
      inputRef.current?.focus();
    }
  }, [humanTurn?.pick, humanTurn?.participantId]);

  if (!humanTurn) return null;

  const clearFeedback = () => {
    setError("");
    setAlert("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const player = name.trim();
    if (!player) {
      setError("Enter a player name");
      setAlert("");
      return;
    }
    if (isTaken(player, takenPlayers)) {
      setError(`"${player}" is already drafted. Check the pick log.`);
      setAlert("");
      return;
    }

    setSubmitting(true);
    clearFeedback();
    try {
      await onSubmit(player);
    } catch (err) {
      if (err.code === "PLAYER_NOT_FOUND") {
        setAlert(err.message || "Player not found. Check the spelling and try again.");
        setError("");
        inputRef.current?.focus();
      } else {
        setError(err.message || "Could not submit pick");
        setAlert("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="human-pick-bar animate-in" role="region" aria-label={`${humanTurn.label} draft pick`}>
      <form className="human-pick-form" onSubmit={handleSubmit}>
        <div className="human-pick-copy">
          <span className="human-pick-label">{humanTurn.label}&apos;s pick</span>
          <span className="human-pick-meta">
            Round {humanTurn.round} · Pick #{humanTurn.pick}
          </span>
        </div>
        {customRules?.trim() && (
          <p className="human-pick-rules" title={customRules.trim()}>
            Rules: {customRules.trim()}
          </p>
        )}
        <div className="human-pick-input-row">
          <input
            ref={inputRef}
            type="text"
            className="human-pick-input"
            placeholder={`${humanTurn.league} player name`}
            value={name}
            disabled={submitting}
            onChange={(e) => {
              setName(e.target.value);
              if (error || alert) clearFeedback();
            }}
            aria-invalid={!!error}
            aria-describedby={alert ? "human-pick-alert" : error ? "human-pick-error" : undefined}
          />
          <button
            type="submit"
            className="human-pick-submit"
            disabled={submitting || !name.trim()}
          >
            {submitting ? "Checking…" : "Draft"}
          </button>
        </div>
        {alert && (
          <p className="human-pick-alert" id="human-pick-alert" role="status">
            {alert}
          </p>
        )}
        {error && (
          <p className="human-pick-error" id="human-pick-error">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

export default HumanPickBar;
