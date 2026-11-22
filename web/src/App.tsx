import type { ReactNode } from "react";
import { Link, Navigate, Route, Routes } from "react-router";
import { useAuth } from "./auth";
import type { Role } from "./api";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";

function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted">Cargando…</p>;
  if (!user) return <Navigate to="/ingresar" replace />;
  if (user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export function App() {
  const { user, logout } = useAuth();
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          <img src="/icon.svg" alt="" width={28} height={28} /> AchoFlores
        </Link>
        <nav>
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
          <Route path="/" element={<Home />} />
          <Route path="/ingresar" element={<Login />} />
          <Route path="/registro" element={<Register />} />
          <Route
            path="/mi-puesto"
            element={
              <RequireRole role="MERCHANT">
                <p>Panel del comerciante: próximamente.</p>
              </RequireRole>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireRole role="ADMIN">
                <p>Panel de administración: próximamente.</p>
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
