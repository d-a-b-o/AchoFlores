import { Link } from "react-router";

export function Home() {
  return (
    <>
      <section className="hero">
        <h1>Flores del Mercado de Acho, sin ir al Rímac</h1>
        <p>Rosas, girasoles, arreglos y coronas a precio de mercado, directo de los puestos de Acho.</p>
        <div className="row">
          <Link className="btn" to="/registro">
            Crear cuenta
          </Link>
          <Link className="btn btn-ghost" to="/registro?tipo=comerciante">
            Soy comerciante
          </Link>
        </div>
      </section>
      <section className="steps">
        <article>
          <h3>1. El puesto se registra</h3>
          <p>El comerciante registra su puesto y el mercado lo aprueba.</p>
        </article>
        <article>
          <h3>2. Publica desde el celular</h3>
          <p>Foto, precio y stock en menos de un minuto.</p>
        </article>
        <article>
          <h3>3. Tú compras en línea</h3>
          <p>Catálogo, carrito y delivery en Lima (próximos sprints).</p>
        </article>
      </section>
    </>
  );
}
