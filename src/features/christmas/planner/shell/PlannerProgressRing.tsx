export function PlannerProgressRing({
  percent,
  done,
  total,
}: {
  percent: number;
  done: number;
  total: number;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = 36;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;
  return (
    <div className="tdg-planner-ring" role="img" aria-label={`${clamped} percent planned`}>
      <svg viewBox="0 0 88 88" width="88" height="88" aria-hidden>
        <circle className="tdg-planner-ring-track" cx="44" cy="44" r={r} />
        <circle
          className="tdg-planner-ring-value"
          cx="44"
          cy="44"
          r={r}
          strokeDasharray={`${dash} ${c}`}
          transform="rotate(-90 44 44)"
        />
      </svg>
      <div className="tdg-planner-ring-label">
        <strong>
          {done}/{total}
        </strong>
      </div>
    </div>
  );
}
