import ModuleGrid from "./ModuleGrid";
import { modules } from "../data/modules";

export default function RoleDashboard({ role, subtitle, moduleIds }) {
  const allowedModules = modules.filter((module) => moduleIds.includes(module.id));

  return (
    <section className="dashboard-page">
      <div className="page-heading">
        <p>{role} Dashboard</p>
        <h1>{subtitle}</h1>
      </div>
      <ModuleGrid allowedModules={allowedModules} />
    </section>
  );
}
