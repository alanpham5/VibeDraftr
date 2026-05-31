import { useRef, useEffect, useMemo } from 'react';
import { AI_LOGOS, PlayerAvatar, PlayerAvatarFallback } from './uiHelpers';
import { getPlayerProfileUrl } from '../utils/playerLinks.js';
import { formatPickLogDisplayNames } from '../utils/pickLogNames.js';

function PickLog({
  picks,
  aiColors,
  league,
  statsSeason,
  resolvePlayer,
  reserveBottomSpace = false,
}) {
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [picks.length]);

  const displayNames = useMemo(
    () => formatPickLogDisplayNames(picks, resolvePlayer),
    [picks, resolvePlayer],
  );

  return (
    <>
      <div className="pick-log-header animate-fade">Pick Log</div>
      <div
        className={`pick-log scroller${reserveBottomSpace ? " pick-log--reserve-sticky" : ""}`}
        ref={logRef}
      >
        {picks.length === 0 ? (
          <div className="empty-state">
            <span className="empty-text">Waiting for picks</span>
          </div>
        ) : (
          picks.map((p, i) => {
            const entry = resolvePlayer?.(p.player);
            const fullName = entry?.name || p.player;
            const lastName = displayNames[i];
            const model = p.model || p.aiName;
            const pickerLabel = p.label || p.aiName;
            const profileUrl = getPlayerProfileUrl(league, entry, statsSeason);
            const entryClass = `pick-log-entry${profileUrl ? " player-card-link" : ""}`;

            const entryContent = (
              <>
                <span className="log-pick-num">#{p.pick}</span>
                <span
                  className="log-picker-icon"
                  style={{ color: aiColors[model]?.accent }}
                  title={pickerLabel}
                  aria-label={pickerLabel}
                >
                  {AI_LOGOS[model]}
                </span>
                {entry?.matched && entry.headshot ? (
                  <PlayerAvatar headshot={entry.headshot} name={fullName} />
                ) : (
                  <PlayerAvatarFallback />
                )}
                <span className="log-player-name">{lastName}</span>
              </>
            );

            return profileUrl ? (
              <a
                key={i}
                className={entryClass}
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {entryContent}
              </a>
            ) : (
              <div
                key={i}
                className={entryClass}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {entryContent}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

export default PickLog;
