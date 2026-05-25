import { Outlet } from "react-router-dom";

export default function ChairmanLayout() {
  return (
    <main className="role-layout chairman-layout">
      <header className="role-header">
        <p>Student Academic Record Management</p>
        <h1>Chairman Dashboard</h1>
      </header>
      <Outlet />
    </main>
  );
}
