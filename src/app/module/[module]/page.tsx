import { notFound } from "next/navigation";
import Link from "next/link";
import {
  MarketingNav,
  MarketingFooter,
  ProductDemo,
} from "@/components/marketing";
import { products } from "@/lib/product-content";
import { catalog } from "@/lib/catalog";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const id = (await params).module;
  const product = products.find((m) => m.id === id);
  return {
    title: `LYNO ${product?.name || "Module"}`,
    description: product?.description,
  };
}
export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const id = (await params).module,
    p = products.find((p) => p.id === id);
  if (!p) notFound();
  const config = catalog(),
    extra = config.modules.find((m) => m.id === id),
    core = config.plans[0];
  return (
    <>
      <MarketingNav />
      <main id="main">
        <section className="section module-hero">
          <Link className="back-link" href="/#module">
            ← Alle Module
          </Link>
          <span className="eyebrow">
            LYNO {p.name.toUpperCase()} / {p.eyebrow.toUpperCase()}
          </span>
          <h1>{p.headline}</h1>
          <p>{p.description}</p>
          <div className="hero-actions">
            <Link
              className="button"
              href={`/registrieren?plan=starter&modules=${p.id === "core" ? "" : p.id}`}
            >
              LYNO {p.name} ausprobieren →
            </Link>
            <Link className="button secondary" href="/preise">
              Pakete vergleichen
            </Link>
          </div>
          <small>
            Starter CORE ab {core.corePrice} € / Monat
            {extra ? ` + ${extra.price} € für ${extra.name}` : ""} ·
            Preisvorschlag, netto · ausschließlich Testbetrieb
          </small>
        </section>
        <section className="section product-intro">
          <div className="value-columns">
            {p.features.map(([title, body], i) => (
              <article key={title}>
                <span>0{i + 1}</span>
                <h2>{title}</h2>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="section module-scenario">
          <span className="eyebrow">SO KANN IHR TEAM ARBEITEN</span>
          <h2>{p.scenario}</h2>
          {p.id === "flow" ? (
            <ProductDemo expanded />
          ) : (
            <div className="module-context">
              <span>CORE</span>
              <span>FLOW</span>
              <span>ACADEMY</span>
              <span>ASSIST</span>
              <span>INSIGHTS</span>
              <p>
                Eine Firmenstruktur, gemeinsame Rechte und miteinander
                verbundenes Wissen.
              </p>
            </div>
          )}
        </section>
        <section className="section closing-cta">
          <h2>Starten Sie mit Ihrem eigenen Arbeitsraum.</h2>
          <p>
            14 Tage alle Module kennenlernen. Anschließend genau die Funktionen
            buchen, die Sie brauchen.
          </p>
          <Link
            className="button"
            href={`/registrieren?plan=starter&modules=${p.id === "core" ? "" : p.id}`}
          >
            Firma registrieren →
          </Link>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
