import AnalyticsAdminShell from "./AnalyticsAdminShell";
import { useAdminNavAlerts } from "@/hooks/useAdminNavAlerts";
import "./admin-theme.css";

function AdminLayout() {
  const alerts = useAdminNavAlerts();
  return <AnalyticsAdminShell alerts={alerts} />;
}
export default AdminLayout;
export { AdminLayout };
