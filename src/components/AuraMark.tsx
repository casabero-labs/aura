export default function AuraMark() {
  return (
    <svg
      className="aura-mark aura-data-mark"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      aria-hidden="true"
    >
      <ellipse cx="32" cy="32" rx="24" ry="8.5" />
      <ellipse cx="32" cy="32" rx="24" ry="8.5" transform="rotate(60 32 32)" />
      <ellipse cx="32" cy="32" rx="24" ry="8.5" transform="rotate(-60 32 32)" />
    </svg>
  );
}
