import { Navigate, useLocation } from "react-router-dom";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  children: JSX.Element;
  requireRole?: AppRole | AppRole[];
}

export const ProtectedRoute = ({ children, requireRole }: Props) => {
  const { session, roles, isActive, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" state={{ from: location }} replace />;

  // User authenticated but not yet validated/activated by a super admin
  if (!isActive || roles.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="items-center text-center space-y-2">
            <div className="rounded-full bg-muted p-3 text-primary">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <CardTitle>Cuenta pendiente de validación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Tu cuenta ha sido creada correctamente. Un super administrador debe validarla y asignarte un rol antes de que puedas acceder al CRM.
            </p>
            <Button variant="outline" className="w-full" onClick={() => signOut()}>
              Cerrar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (requireRole) {
    const need = Array.isArray(requireRole) ? requireRole : [requireRole];
    if (!need.some((r) => roles.includes(r))) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
};
