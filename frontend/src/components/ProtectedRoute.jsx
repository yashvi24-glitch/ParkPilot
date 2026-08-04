import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Logged-out visitors land back on the (guest) Dashboard rather than being
// dropped straight into the Login form — Login is only reached by explicitly
// choosing to log in (e.g. clicking a feature card on the Dashboard).
export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return children;
}
