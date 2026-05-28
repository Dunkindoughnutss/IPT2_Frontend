import { Link } from "react-router-dom";
import { modules } from "../data/modules";

export default function ModuleGrid({ allowedModules = modules }) {
  return (
    <div className="module-grid">
      {allowedModules.map((module) => (
        <Link className="module-card" key={module.id} to={module.path}>
          <span>{module.title}</span>
          <p>{module.description}</p>
        </Link>
      ))}
    </div>
  );
}
