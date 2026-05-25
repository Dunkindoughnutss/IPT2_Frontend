import { Navigate, Route, Routes } from "react-router-dom";
import ChairmanLayout from "./layouts/ChairmanLayout";
import DeanLayout from "./layouts/DeanLayout";
import FacultyLayout from "./layouts/FacultyLayout";
import RegistrarLayout from "./layouts/RegistrarLayout";
import StudentLayout from "./layouts/StudentLayout";
import Login from "./pages/Login";
import ChairmanDashboard from "./pages/chairman/ChairmanDashboard";
import DeanDashboard from "./pages/dean/DeanDashboard";
import FacultyDashboard from "./pages/faculty/FacultyDashboard";
import RegistrarDashboard from "./pages/registrar/RegistrarDashboard";
import StudentDashboard from "./pages/student/StudentDashboard";
import AcademicRecordManagement from "./modules/academic-record-management";
import DescriptiveAnalytics from "./modules/descriptive-analytics";
import GradeManagement from "./modules/grade-management";
import StudentKiosksPortal from "./modules/student-kiosks-portal";
import StudentRecordManagement from "./modules/student-record-management";
import UserManagement from "./modules/user-management";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      <Route path="/student" element={<StudentLayout />}>
        <Route index element={<StudentDashboard />} />
      </Route>

      <Route path="/faculty" element={<FacultyLayout />}>
        <Route index element={<FacultyDashboard />} />
      </Route>

      <Route path="/dean" element={<DeanLayout />}>
        <Route index element={<DeanDashboard />} />
      </Route>

      <Route path="/chairman" element={<ChairmanLayout />}>
        <Route index element={<ChairmanDashboard />} />
      </Route>

      <Route path="/registrar" element={<RegistrarLayout />}>
        <Route index element={<RegistrarDashboard />} />
      </Route>

      <Route path="/modules/user-management" element={<UserManagement />} />
      <Route path="/modules/academic-record-management" element={<AcademicRecordManagement />} />
      <Route path="/modules/student-record-management" element={<StudentRecordManagement />} />
      <Route path="/modules/grade-management" element={<GradeManagement />} />
      <Route path="/modules/descriptive-analytics" element={<DescriptiveAnalytics />} />
      <Route path="/modules/student-kiosks-portal" element={<StudentKiosksPortal />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
