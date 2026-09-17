import { NavLink, Outlet } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import "./planner.css";

export default function ChristmasPlannerLayout() {
  return (
    <div className="tdg-planner">
      <PageHead
        title="Christmas Planner"
        description="Your private Christmas command center."
        noindex
        exactTitle
      />
      <div className="tdg-planner-shell">
        <Outlet />
      </div>
      <nav className="tdg-planner-nav" aria-label="Christmas planner">
        <NavLink to="/account/christmas" end className={({ isActive }) => (isActive ? "active" : "")}>
          Today
        </NavLink>
        <NavLink to="/account/christmas/plan" className={({ isActive }) => (isActive ? "active" : "")}>
          Plan
        </NavLink>
        <NavLink to="/account/christmas/gifts" className={({ isActive }) => (isActive ? "active" : "")}>
          Gifts
        </NavLink>
        <NavLink to="/account/christmas/more" className={({ isActive }) => (isActive ? "active" : "")}>
          More
        </NavLink>
      </nav>
    </div>
  );
}
