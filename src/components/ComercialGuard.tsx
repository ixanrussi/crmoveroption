import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ReactNode } from "react";

const ALLOWED_FOR_COMERCIAL = ["/calculadora-fijos", "/mi-cuenta", "/prospects/afiliados"];

export const ComercialGuard = ({ children }: { children: ReactNode }) => {
  const { isComercial, isAdmin } = useAuth();
  const { pathname } = useLocation();
  if (isComercial && !isAdmin && !ALLOWED_FOR_COMERCIAL.includes(pathname)) {
    return <Navigate to="/calculadora-fijos" replace />;
  }
  return <>{children}</>;
};
