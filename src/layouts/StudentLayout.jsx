import { Outlet } from "react-router-dom";

export default function StudentLayout() {
  return (
    <main className="role-layout student-layout">
      <header className="role-header">
        <p>Student Academic Record Management</p>
        <h1>Student Portal</h1>
      </header>
      <Outlet />
    </main>
  );
}
