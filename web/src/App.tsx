import { Link, Route, Routes } from "react-router";
import { Home } from "./pages/Home";

export function App() {
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          <img src="/icon.svg" alt="" width={28} height={28} /> AchoFlores
        </Link>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<p>Página no encontrada.</p>} />
        </Routes>
      </main>
      <footer className="footer">Mercado de Flores de Acho · Rímac, Lima</footer>
    </>
  );
}
