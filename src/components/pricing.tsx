"use client";
import { useState } from "react";
import Link from "next/link";
import type { catalog } from "@/lib/catalog";
import type { campaignStatus } from "@/lib/discount";
export function Pricing({
  config,
  campaign,
}: {
  config: ReturnType<typeof catalog>;
  campaign: Awaited<ReturnType<typeof campaignStatus>>;
}) {
  const [modules, setModules] = useState<string[]>([
    "flow",
    "academy",
    "assist",
    "insights",
  ]);
  return (
    <section className="section pricing-section" id="preise">
      <div className="section-label">
        <span>IHRE KONFIGURATION</span>
        <span>MONATLICH PLANBAR</span>
      </div>
      <div className="centered-heading">
        <h2>
          Die Grundlage steht.
          <br />
          Der Rest passt sich Ihnen an.
        </h2>
        <p>
          CORE ist immer dabei. Wählen Sie Ihre Module oder das Gesamtbundle.
        </p>
      </div>
      <div className="module-picker">
        {config.modules.map((m) => (
          <label className="checkbox-label" key={m.id}>
            <input
              type="checkbox"
              checked={modules.includes(m.id)}
              onChange={(e) =>
                setModules(
                  e.target.checked
                    ? [...modules, m.id]
                    : modules.filter((id) => id !== m.id),
                )
              }
            />
            {m.name} <small>+{m.price} €</small>
          </label>
        ))}
      </div>
      <div className="pricing-grid">
        {config.plans.map((p, i) => {
          const separate =
            p.corePrice +
            config.modules
              .filter((m) => modules.includes(m.id))
              .reduce((n, m) => n + m.price, 0);
          const amount =
            modules.length === 4 ? Math.min(p.price, separate) : separate;
          return (
            <article
              className={`price-card ${i === 1 ? "featured" : ""}`}
              key={p.id}
            >
              <span className="eyebrow">{p.name}</span>
              <h3>{p.description}</h3>
              <div className="price">
                {amount} €<span>/ Monat</span>
              </div>
              <p>
                {modules.length === 4
                  ? "Gesamtbundle"
                  : "CORE + gewählte Module"}{" "}
                · netto
              </p>
              <Link
                href={`/registrieren?plan=${p.id}&modules=${modules.join(",")}`}
                className={`button ${i === 1 ? "" : "secondary"}`}
              >
                14 Tage ausprobieren →
              </Link>
              <dl className="plan-facts">
                <div>
                  <dt>Mitarbeitende</dt>
                  <dd>{p.seats}</dd>
                </div>
                <div>
                  <dt>Automationen</dt>
                  <dd>{p.automations}</dd>
                </div>
                <div>
                  <dt>KI-Anfragen / Tag</dt>
                  <dd>{p.aiDaily}</dd>
                </div>
                <div>
                  <dt>Dokumente</dt>
                  <dd>{p.documentMB} MB</dd>
                </div>
                <div>
                  <dt>Individuelle Rollen</dt>
                  <dd>{p.customRoles ? "Enthalten" : "Ab Business"}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
      <div className="campaign-note">
        <strong>
          {campaign.enabled
            ? `${campaign.remaining} von ${campaign.capacity} Testplätzen frei`
            : "Startaktion pausiert"}
        </strong>
        <p>
          {campaign.percent}% Startrabatt für {campaign.months} Monate, einmalig
          für erstmalig zahlende Neukunden. Der Datenbankzähler berücksichtigt
          bestätigte Testzahlungen und offene Reservierungen. Danach gilt der
          reguläre Monatspreis.
        </p>
      </div>
      <p className="pricing-note">
        Preisvorschläge zzgl. gesetzlicher USt. · Keine echten Zahlungen,
        ausschließlich Testbetrieb.
        <br />
        Die Zähler stellen keine realen Kunden dar. Kommerzieller
        Vertragsschluss noch nicht freigegeben.
      </p>
    </section>
  );
}
