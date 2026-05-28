import RoleDashboard from "../../components/RoleDashboard";

export default function FacultyDashboard() {
  return (
    <RoleDashboard
      role="Faculty"
      subtitle="Encode grades, review class records, and monitor student performance."
      moduleIds={[
        "student-record-management",
        "grade-management",
        "descriptive-analytics",
      ]}
    />
  );
}
