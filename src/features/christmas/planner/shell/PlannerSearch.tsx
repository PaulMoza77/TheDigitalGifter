import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchPlannerModules } from "./modules";

export function PlannerSearch({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const results = useMemo(() => searchPlannerModules(q), [q]);

  function go(href: string) {
    setOpen(false);
    setQ("");
    navigate(href);
  }

  return (
    <div className={`tdg-planner-search${compact ? " is-compact" : ""}`}>
      <label className="tdg-planner-sr" htmlFor="planner-search">
        Search planner
      </label>
      <input
        id="planner-search"
        type="search"
        placeholder="Search anything..."
        value={q}
        autoComplete="off"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) {
            e.preventDefault();
            go(results[0].href);
          }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && q.trim() && results.length > 0 ? (
        <ul className="tdg-planner-search-list" role="listbox">
          {results.map((row) => (
            <li key={row.id}>
              <button type="button" onClick={() => go(row.href)}>
                {row.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
