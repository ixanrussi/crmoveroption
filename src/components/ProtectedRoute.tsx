import { Navigate, useLocation } from "react-router-dom";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface Props {
  children: JSX.Element;
  requireRole?: AppRole | AppRole[];
}

export const ProtectedRoute = ({ children, requireRole }: Props) => {
  const { session, roles, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" state={{ from: location }} replace />;

  if (requireRole) {
    const need = Array.isArray(requireRole) ? requireRole : [requireRole];
    if (!need.some((r) => roles.includes(r))) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
};
