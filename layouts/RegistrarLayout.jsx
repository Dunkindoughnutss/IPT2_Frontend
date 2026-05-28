import { Outlet } from "react-router-dom";

export default function RegistrarLayout() {
  return (
    <main className="role-layout registrar-layout">
      <header className="role-header">
        <p>Student Academic Record Management</p>
        <h1>Registrar Dashboard</h1>
      </header>
      <Outlet />
    </main>
  );
}
