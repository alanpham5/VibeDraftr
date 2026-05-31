import { useId } from "react";
import {
  createDefaultScoringConfig,
  formatNhlGoalieScoringSummary,
  getStatOptionsForLeague,
} from "../engine/fantasyScoring.js";

const CUSTOM_RULES_PLACEHOLDER = {
  NBA: "e.g. $150M salary cap. LeBron James and Stephen Curry are protected and cannot be drafted.",
  NHL: "e.g. $88M salary cap. Connor McDavid and Sidney Crosby are protected and cannot be drafted.",
};

function AdvancedScoringOptions({
  league,
  value,
  onChange,
  customRules,
  onCustomRulesChange,
}) {
  const panelId = useId();
  const scoringId = useId();
  const statOptions = getStatOptionsForLeague(league);
  const config = value || createDefaultScoringConfig(league);

  const updateTerm = (index, field, nextValue) => {
    const terms = config.terms.map((term, i) =>
      i === index ? { ...term, [field]: nextValue } : term,
    );
    onChange({ ...config, terms });
  };

  const addTerm = () => {
    onChange({
      ...config,
      terms: [
        ...config.terms,
        { stat: statOptions[0]?.key || "PTS", coefficient: 1 },
      ],
    });
  };

  const removeTerm = (index) => {
    if (config.terms.length <= 1) return;
    onChange({
      ...config,
      terms: config.terms.filter((_, i) => i !== index),
    });
  };

  const resetDefaults = () => {
    onChange(createDefaultScoringConfig(league));
  };

  const scoringHint = config.useCustom
    ? "Custom formula enabled"
    : "Default scoring";

  return (
    <div className="field advanced-options-field animate-in animate-delay-5">
      <label htmlFor={panelId}>Advanced Options</label>
      <details className="advanced-options">
        <summary className="advanced-options-summary">
          <span className="advanced-options-summary-copy">
            <span className="advanced-options-summary-text">
              Scoring & draft rules
            </span>
            <span className="advanced-options-summary-hint">
              {customRules.trim()
                ? `${scoringHint} · Rules set`
                : scoringHint}
            </span>
          </span>
          <span className="advanced-options-chevron" aria-hidden="true" />
        </summary>
        <div className="advanced-options-body" id={panelId}>
          <details className="advanced-options-subpanel">
            <summary className="advanced-options-subpanel-summary">
              <span className="advanced-options-summary-copy">
                <span className="advanced-options-subpanel-title">
                  Custom fantasy scoring
                </span>
                <span className="advanced-options-summary-hint">
                  {scoringHint}
                </span>
              </span>
              <span className="advanced-options-chevron" aria-hidden="true" />
            </summary>
            <div className="advanced-options-subpanel-body" id={scoringId}>
              <p className="advanced-options-help">
                Build a custom fantasy formula for {league} using box score stats
                from the latest season. Use negative coefficients for penalties
                (e.g.{" "}
                <code className="advanced-options-negative-example">-0.5</code>{" "}
                for turnovers).
                {league === "NHL" && (
                  <>
                    {" "}
                    Custom scoring applies to <strong>skaters only</strong>.
                    Goalies always use the default goalie formula below.
                  </>
                )}
              </p>

              {league === "NHL" && (
                <p className="advanced-options-help advanced-options-goalie-scoring">
                  <strong>Goalie scoring:</strong>{" "}
                  {formatNhlGoalieScoringSummary()}
                </p>
              )}

              <label
                className={`advanced-options-toggle${config.useCustom ? " checked" : ""}`}
              >
                <span className="advanced-options-toggle-text">
                  Use custom scoring formula
                </span>
                <input
                  type="checkbox"
                  checked={config.useCustom}
                  onChange={(e) =>
                    onChange({ ...config, useCustom: e.target.checked })
                  }
                />
                <span className="advanced-options-switch" aria-hidden="true" />
              </label>

              <div
                className={`formula-builder${config.useCustom ? "" : " formula-builder-disabled"}`}
              >
                <div className="formula-builder-header">
                  <span>Stat</span>
                  <span>Coefficient</span>
                  <span aria-hidden="true" />
                </div>

                {config.terms.map((term, index) => (
                  <div className="formula-row" key={`${term.stat}-${index}`}>
                    <select
                      value={term.stat}
                      disabled={!config.useCustom}
                      onChange={(e) => updateTerm(index, "stat", e.target.value)}
                    >
                      {statOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={term.coefficient}
                      disabled={!config.useCustom}
                      onChange={(e) =>
                        updateTerm(
                          index,
                          "coefficient",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                    />
                    <button
                      type="button"
                      className="formula-remove"
                      disabled={!config.useCustom || config.terms.length <= 1}
                      onClick={() => removeTerm(index)}
                      aria-label="Remove stat"
                    >
                      ×
                    </button>
                  </div>
                ))}

                <div className="formula-actions">
                  <button
                    type="button"
                    className="add-participant-btn add-formula-term"
                    disabled={!config.useCustom}
                    onClick={addTerm}
                  >
                    + Add stat
                  </button>
                  <button
                    type="button"
                    className="add-participant-btn reset-formula"
                    disabled={!config.useCustom}
                    onClick={resetDefaults}
                  >
                    Reset to default
                  </button>
                </div>
              </div>
            </div>
          </details>

          <div className="advanced-options-section">
            <h3 className="advanced-options-subheading">
              Custom rules & limitations
            </h3>
            <p className="advanced-options-help advanced-options-help-flush">
              Optional constraints for all drafters, such as a salary cap,
              protected players, or position limits. AIs will follow these rules
              when picking.
            </p>
            <textarea
              className="custom-rules-input"
              placeholder={
                CUSTOM_RULES_PLACEHOLDER[league] ||
                "e.g. Salary cap limits, protected players, or position requirements."
              }
              value={customRules}
              onChange={(e) => onCustomRulesChange(e.target.value)}
              rows={4}
            />
          </div>
        </div>
      </details>
    </div>
  );
}

export default AdvancedScoringOptions;
