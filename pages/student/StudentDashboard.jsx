import RoleDashboard from "../../components/RoleDashboard";

export default function StudentDashboard() {
  return (
    <RoleDashboard
      role="Student"
      subtitle="View records, grades, progress, and portal services."
      moduleIds={[
        "academic-record-management",
        "student-record-management",
        "grade-management",
        "student-kiosks-portal",
      ]}
    />
  );
}
