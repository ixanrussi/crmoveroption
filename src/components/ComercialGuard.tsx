import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ReactNode } from "react";

const ALLOWED_FOR_COMERCIAL = ["/calculadora-fijos", "/mi-cuenta", "/prospects/afiliados", "/solicitar-links"];
const ALLOWED_FOR_AFFILIATE = ["/portal-afiliado", "/mi-cuenta"];

export const ComercialGuard = ({ children }: { children: ReactNode }) => {
  const { isComercial, isAdmin, isAffiliate, isSuperAdmin } = useAuth();
  const { pathname } = useLocation();

  if (isAffiliate && !isAdmin && !isSuperAdmin && !ALLOWED_FOR_AFFILIATE.includes(pathname)) {
    return <Navigate to="/portal-afiliado" replace />;
  }
  if (isComercial && !isAdmin && !ALLOWED_FOR_COMERCIAL.includes(pathname)) {
    return <Navigate to="/calculadora-fijos" replace />;
  }
  return <>{children}</>;
};
