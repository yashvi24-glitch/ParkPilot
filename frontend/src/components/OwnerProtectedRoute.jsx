import { Navigate } from "react-router-dom";
import { useOwnerAuth } from "../context/OwnerAuthContext";

// Unlike the User Portal's ProtectedRoute, the Owner Portal has no guest
// mode to fall back to — logged-out visitors go straight to Owner Login.
export default function OwnerProtectedRoute({ children }) {
  const { isOwnerAuthenticated } = useOwnerAuth();

  if (!isOwnerAuthenticated) {
    return <Navigate to="/owner/login" replace />;
  }

  return children;
}
