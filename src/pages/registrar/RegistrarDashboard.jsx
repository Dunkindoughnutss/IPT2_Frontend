import RoleDashboard from "../../components/RoleDashboard";

export default function RegistrarDashboard() {
  return (
    <RoleDashboard
      role="Registrar"
      subtitle="Control official academic records, user access, and grade approvals."
      moduleIds={[
        "user-management",
        "academic-record-management",
        "student-record-management",
        "grade-management",
        "descriptive-analytics",
      ]}
    />
  );
}
