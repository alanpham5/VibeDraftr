import { AI_LOGOS, PlayerAvatar, PlayerAvatarFallback } from "./uiHelpers";
import { formatFantasyPoints } from "../engine/fantasyScoring.js";
import { getPlayerProfileUrl } from "../utils/playerLinks.js";

function TeamPanel({
  label,
  model,
  strategy,
  roster = [],
  rosterEntries = [],
  fantasyTotal = 0,
  league,
  statsSeason,
  color = {},
  pickSlot,
  isOnClock = false,
  isDraftComplete = false,
  statsLoading = false,
}) {
  const safeRoster = Array.isArray(roster) ? roster : [];
  const entryByPick = new Map(
    rosterEntries.map((entry) => [entry.pickName, entry]),
  );

  return (
    <div
      className={`team-card focus-block${!isDraftComplete && isOnClock ? " team-card-on-clock" : ""}`}
    >
      <div className="team-card-header">
        {pickSlot != null && (
          <span className="team-pick-slot" aria-label={`Pick ${pickSlot}`}>
            {pickSlot}
          </span>
        )}
        <div
          className="team-header-logo"
          style={{ color: color?.accent ?? "inherit" }}
        >
          {AI_LOGOS[model]}
        </div>
        <div className="team-header-text">
          <h3>{label}</h3>
          {strategy && <p className="team-strategy">{strategy}</p>}
        </div>
        <span className="roster-count">{safeRoster.length}</span>
      </div>

      <ul className="team-roster">
        {safeRoster.map((player, i) => {
          const entry = entryByPick.get(player);
          const displayName = entry?.name || player;
          const fantasyPoints = entry?.fantasyPoints;
          const profileUrl = getPlayerProfileUrl(league, entry, statsSeason);

          const itemClass = `roster-item ${!isDraftComplete && i === safeRoster.length - 1 ? "new-pick" : ""}`;
          const itemContent = (
            <>
              <span className="roster-num">{i + 1}</span>
              {entry?.matched && entry.headshot ? (
                <PlayerAvatar headshot={entry.headshot} name={displayName} />
              ) : (
                <PlayerAvatarFallback />
              )}
              <div className="roster-player-meta">
                <span className="player-name">{displayName}</span>
                <span className="player-fantasy-points">
                  {statsLoading
                    ? "…"
                    : `${formatFantasyPoints(fantasyPoints)} FP`}
                </span>
              </div>
            </>
          );

          return (
            <li key={`${player}-${i}`} className={itemClass}>
              {profileUrl ? (
                <a
                  className="roster-item-link player-card-link"
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {itemContent}
                </a>
              ) : (
                itemContent
              )}
            </li>
          );
        })}
        {safeRoster.length === 0 && (
          <li className="roster-item-empty">
            <span className="player-name-empty">No picks yet</span>
          </li>
        )}
      </ul>

      <div className="team-fantasy-footer">
        <span className="team-fantasy-label">Fantasy total</span>
        <span className="team-fantasy-total">
          {statsLoading ? "…" : `${formatFantasyPoints(fantasyTotal)} FP`}
        </span>
      </div>
    </div>
  );
}

export default TeamPanel;
