import { Outlet } from "react-router-dom";

export default function DeanLayout() {
  return (
    <main className="role-layout dean-layout">
      <header className="role-header">
        <p>Student Academic Record Management</p>
        <h1>Dean Dashboard</h1>
      </header>
      <Outlet />
    </main>
  );
}
