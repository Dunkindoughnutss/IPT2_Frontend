import { Outlet } from "react-router-dom";

export default function FacultyLayout() {
  return (
    <main className="role-layout faculty-layout">
      <header className="role-header">
        <p>Student Academic Record Management</p>
        <h1>Faculty Workspace</h1>
      </header>
      <Outlet />
    </main>
  );
}
