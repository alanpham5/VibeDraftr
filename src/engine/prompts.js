export function buildMessages({
  league,
  aiName,
  round,
  pick,
  totalRounds,
  rosterSoFar,
  allPickedPlayers,
  strategy,
  customRules,
}) {
  const systemContent = `You are ${aiName}, a fantasy sports GM drafting a ${league} team. You must respond with ONLY the full name of the player you want to draft. No explanations, no punctuation, no extra text. Just the player's full name.`;

  const rosterDisplay = rosterSoFar.length > 0
    ? rosterSoFar.join(', ')
    : 'Empty';

  const pickedList = allPickedPlayers.length > 0
    ? allPickedPlayers.map((p, i) => `${i + 1}. ${p}`).join('\n')
    : 'None';

  let userContent = `League: ${league}
Current date context: ${new Date().toLocaleDateString()}

Round ${round} of ${totalRounds}, Pick #${pick} overall.

Your current roster: ${rosterDisplay}

Players already drafted by ALL teams:
${pickedList}
These players are OFF THE BOARD. You CANNOT pick any of them.`;

  if (strategy) {
    userContent += `\n\nDraft strategy: ${strategy}`;
  }

  if (customRules) {
    userContent += `\n\nLeague rules & limitations (must follow):\n${customRules}`;
  }

  userContent += '\n\nName the ONE player you are drafting:';

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent },
  ];
}
