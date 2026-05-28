import RoleDashboard from "../../components/RoleDashboard";

export default function DeanDashboard() {
  return (
    <RoleDashboard
      role="Dean"
      subtitle="Oversee academic records, performance reports, and college-level analytics."
      moduleIds={[
        "academic-record-management",
        "grade-management",
        "descriptive-analytics",
        "user-management",
      ]}
    />
  );
}
