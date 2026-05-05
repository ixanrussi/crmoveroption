import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/layouts/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import Afiliados from "./pages/Afiliados";
import Cierres from "./pages/Cierres";
import Usuarios from "./pages/Usuarios";
import MiCuenta from "./pages/MiCuenta";
import SimpleListPage from "./pages/SimpleListPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/mi-cuenta" element={<MiCuenta />} />
              <Route path="/afiliados" element={<Afiliados />} />
              <Route path="/listas/paises" element={<SimpleListPage table="countries" title="Países" withCode />} />
              <Route path="/listas/software" element={<SimpleListPage table="softwares" title="Software" />} />
              <Route path="/listas/canales" element={<SimpleListPage table="affiliate_channels" title="Canales de afiliados" />} />
              <Route path="/usuarios" element={
                <ProtectedRoute requireRole="super_admin"><Usuarios /></ProtectedRoute>
              } />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
