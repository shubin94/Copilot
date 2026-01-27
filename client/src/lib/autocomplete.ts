export function levenshtein(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function getCategorySuggestions(categories: string[], input: string, limit = 6) {
  const q = input.trim().toLowerCase();
  if (!q) return [];
  const allowFuzzy = q.length >= 3;
  const results: Array<{ name: string; score: number; dist: number }> = [];
  for (const name of categories) {
    const lower = name.toLowerCase();
    const starts = lower.startsWith(q);
    const includes = !starts && lower.includes(q);
    const dist = allowFuzzy ? levenshtein(lower, q) : 999;
    const fuzzyMatch = allowFuzzy && dist <= 2;
    if (!(starts || includes || fuzzyMatch)) continue;
    const score = (starts ? 100 : includes ? 60 : 40) - (allowFuzzy ? dist : 0);
    results.push({ name, score, dist });
  }
  return results
    .sort((a, b) => b.score - a.score || a.dist - b.dist || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((x) => x.name);
}
