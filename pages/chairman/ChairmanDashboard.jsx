import RoleDashboard from "../../components/RoleDashboard";

export default function ChairmanDashboard() {
  return (
    <RoleDashboard
      role="Chairman"
      subtitle="Monitor department records, grade submissions, and academic trends."
      moduleIds={[
        "student-record-management",
        "grade-management",
        "descriptive-analytics",
      ]}
    />
  );
}
