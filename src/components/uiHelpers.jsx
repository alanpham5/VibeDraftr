import { SiAnthropic, SiOpenai, SiGooglegemini, SiX } from 'react-icons/si';
import { FaUser } from 'react-icons/fa6';

export const AI_LOGOS = {
  Claude: <SiAnthropic className="ai-logo-svg" />,
  ChatGPT: <SiOpenai className="ai-logo-svg" />,
  Gemini: <SiGooglegemini className="ai-logo-svg" />,
  Grok: <SiX className="ai-logo-svg" />,
  Human: <FaUser className="ai-logo-svg" />,
};

export function PlayerAvatar({ headshot, name }) {
  return (
    <div className="player-avatar-wrap">
      <div className="player-avatar-ring" aria-hidden="true" />
      <img
        className="player-avatar"
        src={headshot}
        alt=""
        loading="lazy"
        onError={(e) => {
          e.currentTarget.src =
            "https://assets.nhle.com/mugs/nhl/default-skater.png";
        }}
      />
      <span className="sr-only">{name}</span>
    </div>
  );
}

export function PlayerAvatarFallback() {
  return (
    <div className="player-avatar-wrap player-avatar-wrap-empty">
      <div className="player-avatar-ring" aria-hidden="true" />
      <span className="player-avatar-fallback" aria-hidden="true">
        ?
      </span>
    </div>
  );
}
