import { useState } from "react";
import { Link } from "react-router-dom";

const roles = [
  { label: "Student", path: "/student" },
  { label: "Faculty", path: "/faculty" },
  { label: "Dean", path: "/dean" },
  { label: "Chairman", path: "/chairman" },
  { label: "Registrar", path: "/registrar" },
];

export default function Login() {
  const [selectedRole, setSelectedRole] = useState(roles[0]);

  function handleSubmit(event) {
    event.preventDefault();
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-heading">
          <p>Student Academic Record Management</p>
          <h1>Sign in</h1>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="role">Role</label>
          <select
            id="role"
            name="role"
            value={selectedRole.label}
            onChange={(event) => {
              const nextRole = roles.find((role) => role.label === event.target.value);
              setSelectedRole(nextRole);
            }}
          >
            {roles.map((role) => (
              <option key={role.label} value={role.label}>
                {role.label}
              </option>
            ))}
          </select>

          <label htmlFor="email">Email or ID number</label>
          <input id="email" name="email" type="text" autoComplete="username" />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
          />

          <Link className="primary-button" to={selectedRole.path}>
            Login as {selectedRole.label}
          </Link>
        </form>
      </section>
    </main>
  );
}
