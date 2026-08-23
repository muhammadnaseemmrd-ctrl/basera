import { Navigate, useLocation } from "react-router-dom";
import { dashboardPathForRole, useAuthStore } from "../store/useAuthStore";

const canonicalRole = (role) => {
  if (role === "owner" || role === "landlord") return "host";
  return role;
};

export function ProtectedRoute({ roles, children }) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (roles?.length && !roles.map(canonicalRole).includes(canonicalRole(user.role))) {
    return <Navigate to={dashboardPathForRole(user.role)} replace />;
  }

  return children;
}
