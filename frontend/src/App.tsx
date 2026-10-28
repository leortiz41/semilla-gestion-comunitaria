const pillars = [
  {
    title: 'Comunidades',
    description: 'Organiza zonas, comunidades, familias y beneficiarios desde un solo lugar.',
  },
  {
    title: 'Recursos',
    description: 'Da seguimiento a donaciones, materiales, presupuestos y su utilización.',
  },
  {
    title: 'Proyectos',
    description: 'Relaciona programas, actividades, evidencias y resultados comunitarios.',
  },
];

function App() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="brand-mark" aria-hidden="true">🌱</div>
        <p className="eyebrow">Gestión comunitaria</p>
        <h1>Semilla</h1>
        <p className="tagline">Recursos que generan desarrollo</p>
        <p className="hero-copy">
          Una plataforma para conectar recursos, programas y personas con el impacto que generan
          en las comunidades.
        </p>
        <div className="actions">
          <button className="primary-button" type="button">Iniciar sesión</button>
          <span className="version-badge">Versión inicial · Semana 1</span>
        </div>
      </section>

      <section className="pillars" aria-label="Áreas principales">
        {pillars.map((pillar) => (
          <article className="pillar-card" key={pillar.title}>
            <h2>{pillar.title}</h2>
            <p>{pillar.description}</p>
          </article>
        ))}
      </section>

      <footer>
        <span>Semilla · Plataforma de Gestión Comunitaria</span>
        <span>Preparada para operación online y offline</span>
      </footer>
    </main>
  );
}

export default App;
