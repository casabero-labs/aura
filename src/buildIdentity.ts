const GIT_SHA_PATTERN = /^[a-f0-9]{7,40}$/i;

const normalizeGitSha = (value: string | undefined): string | null => {
  const candidate = value?.trim();
  return candidate && GIT_SHA_PATTERN.test(candidate) ? candidate.toLowerCase() : null;
};
export const resolveBuildSha = (
  environment: Readonly<Record<string, string | undefined>>,
  gitSha?: string,
): string => {
  const candidates = [
    environment.VITE_AURA_BUILD_SHA,
    environment.SOURCE_COMMIT,
    environment.GITHUB_SHA,
    environment.VERCEL_GIT_COMMIT_SHA,
    environment.COMMIT_SHA,
    gitSha,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeGitSha(candidate);
    if (normalized) return normalized;
  }

  return 'unknown';
};
