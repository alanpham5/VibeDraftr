const GENERATIONAL_SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv|v|vi)$/i;
const PICK_STATUS_SUFFIX = /\s*\([^)]*\)\s*$/g;

export function stripPickStatusSuffix(name) {
  return String(name || "").replace(PICK_STATUS_SUFFIX, "").trim();
}

function isGenerationalSuffix(part) {
  return GENERATIONAL_SUFFIX.test(String(part || "").replace(/\./g, ""));
}

function nameParts(name) {
  return stripPickStatusSuffix(name).split(/\s+/).filter(Boolean);
}

export function getLastName(name) {
  const parts = nameParts(name);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];

  const suffix = parts[parts.length - 1];
  if (isGenerationalSuffix(suffix)) {
    return `${parts[parts.length - 2]} ${suffix}`;
  }
  return suffix;
}

export function getFirstInitial(name) {
  const parts = nameParts(name);
  return parts[0]?.[0]?.toUpperCase() || "";
}

export function formatPickLogDisplayNames(picks, resolvePlayer) {
  const entries = picks.map((p, index) => {
    const entry = resolvePlayer?.(p.player);
    const fullName = stripPickStatusSuffix(entry?.name || p.player);
    const lastName = getLastName(fullName) || fullName;
    const firstInitial = getFirstInitial(fullName);
    return { index, lastName, firstInitial };
  });

  const displayNames = entries.map((entry) => entry.lastName);

  const byLastName = new Map();
  for (const entry of entries) {
    if (!byLastName.has(entry.lastName)) {
      byLastName.set(entry.lastName, []);
    }
    byLastName.get(entry.lastName).push(entry);
  }

  for (const group of byLastName.values()) {
    if (group.length < 2) continue;

    const byInitial = new Map();
    for (const entry of group) {
      if (!byInitial.has(entry.firstInitial)) {
        byInitial.set(entry.firstInitial, []);
      }
      byInitial.get(entry.firstInitial).push(entry);
    }

    for (const [initial, initialGroup] of byInitial) {
      if (initialGroup.length === 1) {
        displayNames[initialGroup[0].index] =
          `${initial}. ${initialGroup[0].lastName}`;
      } else {
        displayNames[initialGroup[0].index] =
          `${initial}. ${initialGroup[0].lastName}`;
      }
    }
  }

  return displayNames;
}
