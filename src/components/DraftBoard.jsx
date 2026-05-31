import { useRef, useEffect } from 'react';

function DraftBoard({ draftOrder, rounds, picks, currentPick, aiColors }) {
  const boardRef = useRef(null);

  useEffect(() => {
    if (boardRef.current && picks.length > 0) {
      boardRef.current.scrollTop = boardRef.current.scrollHeight;
    }
  }, [picks.length]);

  const pickMap = {};
  picks.forEach(p => {
    const key = `${p.round}-${p.aiName}`;
    pickMap[key] = p;
  });

  const roundRows = [];
  for (let r = 1; r <= rounds; r++) {
    roundRows.push(r);
  }

  return (
    <div className="draft-board" ref={boardRef}>
      <table className="draft-table">
        <thead>
          <tr>
            <th className="round-col">RD</th>
            {draftOrder.map(ai => (
              <th key={ai} className="ai-col">
                <div className="ai-header">
                  <span className="ai-dot" style={{ background: aiColors[ai]?.accent }} />
                  {ai}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roundRows.map(r => {
            const order = r % 2 === 1 ? draftOrder : [...draftOrder].reverse();
            return (
              <tr key={r}>
                <td className="round-cell">{r}</td>
                {draftOrder.map(ai => {
                  const pick = pickMap[`${r}-${ai}`];
                  const isActive = currentPick?.round === r && currentPick?.aiName === ai;
                  const orderIdx = order.indexOf(ai);
                  const pickNum = (r - 1) * draftOrder.length + orderIdx + 1;

                  return (
                    <td key={ai}>
                      <div
                        className={`pick-cell ${pick ? 'filled' : ''} ${isActive ? 'active' : ''}`}
                        style={{
                          color: aiColors[ai]?.accent,
                          background: pick ? aiColors[ai]?.bg : 'transparent',
                        }}
                      >
                        {pick ? (
                          <>
                            <div className="pick-number">#{pick.pick}</div>
                            <div className="pick-player">{pick.player}</div>
                          </>
                        ) : isActive ? (
                          <div className="pick-thinking">
                            <div className="dot-pulse">
                              <span /><span /><span />
                            </div>
                          </div>
                        ) : (
                          <div className="pick-number" style={{ opacity: 0.3 }}>#{pickNum}</div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DraftBoard;
