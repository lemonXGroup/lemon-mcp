const hostOperators = ['eq', 'prefix', 'suffix', 'contains'];

export function hasHostWildcardConditions(groups: unknown): boolean {
  return Array.isArray(groups) && groups.some(group => Array.isArray(group?.conditions)
    && group.conditions.some((condition: { field?: string; op?: string; value?: unknown } | null) =>
      condition?.field === 'host' && hostOperators.includes(condition.op || '')
      && typeof condition.value === 'string' && /[*?]/.test(condition.value)));
}

export function supportsHostWildcards(value: unknown): boolean {
  const feature = (value as { host_wildcards?: {
    supported?: boolean; version?: number; root_domain?: boolean; operators?: unknown;
  } } | null)?.host_wildcards;
  const operators = feature?.operators;
  return feature?.supported === true && typeof feature.version === 'number' && feature.version >= 1
    && feature.root_domain === true && Array.isArray(operators)
    && hostOperators.every(op => operators.includes(op));
}
