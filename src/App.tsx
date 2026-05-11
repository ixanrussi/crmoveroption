import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { MenuPermissionsProvider } from "@/hooks/useMenuPermissions";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ComercialGuard } from "@/components/ComercialGuard";
import AppLayout from "@/layouts/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import Afiliados from "./pages/Afiliados";
import Usuarios from "./pages/Usuarios";
import CalculadoraFijos from "./pages/CalculadoraFijos";
import TrackerReport from "./pages/TrackerReport";
import CommissionPlans from "./pages/CommissionPlans";
import ActivityLogs from "./pages/ActivityLogs";
import RoleMenuPermissions from "./pages/RoleMenuPermissions";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <MenuPermissionsProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<ProtectedRoute><ComercialGuard><AppLayout /></ComercialGuard></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/mi-cuenta" element={<MiCuenta />} />
              <Route path="/afiliados" element={<Afiliados />} />
              <Route path="/cierres" element={<Cierres />} />
              <Route path="/comisiones-dashboard" element={<ComisionesDashboard />} />
              <Route path="/calculadora-fijos" element={<CalculadoraFijos />} />
              <Route path="/tracker-report" element={<TrackerReport />} />
              <Route path="/planes-comision" element={<CommissionPlans />} />
              <Route path="/conocimiento" element={<ConocimientoDashboard />} />
              <Route path="/conocimiento/operador" element={<Conocimiento />} />
              <Route path="/listas/paises" element={<SimpleListPage table="countries" title="Países" withCode />} />
              <Route path="/listas/software" element={<SimpleListPage table="softwares" title="Software" />} />
              <Route path="/listas/canales" element={<SimpleListPage table="affiliate_channels" title="Canales de afiliados" />} />
              <Route path="/listas/monedas" element={<SimpleListPage table="currencies" title="Monedas" withCode />} />
              <Route path="/usuarios" element={
                <ProtectedRoute requireRole="super_admin"><Usuarios /></ProtectedRoute>
              } />
              <Route path="/logs" element={
                <ProtectedRoute requireRole="super_admin"><ActivityLogs /></ProtectedRoute>
              } />
              <Route path="/configuracion-roles" element={
                <ProtectedRoute requireRole="super_admin"><RoleMenuPermissions /></ProtectedRoute>
              } />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </MenuPermissionsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
