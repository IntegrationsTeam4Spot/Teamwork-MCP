export function normalizeWorkflowQueryParams(params: Record<string, any> = {}): Record<string, any> {
  const normalized: Record<string, any> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      const filtered = value.filter((item) => item !== undefined && item !== null && String(item).trim() !== "");
      if (filtered.length === 0) {
        continue;
      }
      normalized[key] = filtered.join(",");
      continue;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        continue;
      }
      normalized[key] = trimmed;
      continue;
    }

    normalized[key] = value;
  }

  return normalized;
}

