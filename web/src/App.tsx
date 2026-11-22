import type { ReactNode } from "react";
import { Link, Navigate, Route, Routes } from "react-router";
import { useAuth } from "./auth";
import type { Role } from "./api";
import { Catalog } from "./pages/Catalog";
import { StallProfile } from "./pages/StallProfile";
import { Cart } from "./pages/Cart";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { useCart } from "./cart";
import { Checkout } from "./pages/Checkout";
import { PaymentGateway } from "./pages/PaymentGateway";
import { PurchaseResult } from "./pages/PurchaseResult";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { MerchantDashboard } from "./pages/merchant/Dashboard";
import { AdminStalls } from "./pages/admin/Stalls";

function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted">Cargando…</p>;
  if (!user) return <Navigate to="/ingresar" replace />;
  if (user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export function App() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          <img src="/icon.svg" alt="" width={28} height={28} /> AchoFlores
        </Link>
        <nav>
          <Link to="/carrito" aria-label={`Carrito (${count})`}>
            Carrito{count > 0 && <span className="count">{count}</span>}
          </Link>
          {user?.role === "MERCHANT" && <Link to="/mi-puesto">Mi puesto</Link>}
          {user?.role === "ADMIN" && <Link to="/admin">Administración</Link>}
          {user ? (
            <button className="link" onClick={logout}>
              Salir ({user.name})
            </button>
          ) : (
            <Link to="/ingresar">Ingresar</Link>
          )}
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route path="/puestos/:id" element={<StallProfile />} />
          <Route path="/carrito" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/pasarela/:id" element={<PaymentGateway />} />
          <Route path="/compra/:id" element={<PurchaseResult />} />
          <Route path="/recuperar" element={<ForgotPassword />} />
          <Route path="/restablecer" element={<ResetPassword />} />
          <Route path="/ingresar" element={<Login />} />
          <Route path="/registro" element={<Register />} />
          <Route
            path="/mi-puesto"
            element={
              <RequireRole role="MERCHANT">
                <MerchantDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireRole role="ADMIN">
                <AdminStalls />
              </RequireRole>
            }
          />
          <Route path="*" element={<p>Página no encontrada.</p>} />
        </Routes>
      </main>
      <footer className="footer">Mercado de Flores de Acho · Rímac, Lima</footer>
    </>
  );
}
