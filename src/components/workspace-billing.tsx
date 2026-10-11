"use client";
import { useState } from "react";
import { useApp } from "./app-context";
import {
  ActionForm,
  api,
  Badge,
  Button,
  date,
  Field,
  Modal,
  statusLabel,
} from "./ui";
export function BillingView() {
  const { data, refresh, toast, run } = useApp();
  const [plan, setPlan] = useState(data.organization.plan),
    [modules, setModules] = useState<string[]>(data.organization.modules),
    [review, setReview] = useState(false);
  const p = data.catalog.plans.find((p) => p.id === plan)!;
  const separate =
    p.corePrice +
    data.catalog.modules
      .filter((m) => modules.includes(m.id))
      .reduce((n, m) => n + m.price, 0);
  const total = modules.length === 4 ? Math.min(p.price, separate) : separate;
  const open = data.orders.find(
    (o) =>
      o.status === "pending" &&
      (o.provider === "stripe_test" ||
        new Date(o.expires_at) > new Date(data.now)),
  );
  const owner = data.me.role === "owner";
  async function action(input: unknown) {
    const result = await api<{ url?: string; message: string }>(
      "billing",
      input,
    );
    await refresh();
    toast(result.message);
    if (result.url) window.location.assign(result.url);
  }
  return (
    <>
      <div className="notice mb">
        {data.billingProvider === "stripe-test"
          ? "Stripe-Testmodus"
          : "Lokaler Abrechnungstest"}{" "}
        · Keine echten Zahlungen. Alle Beträge sind konfigurierbare
        Preisvorschläge, netto pro Monat.
      </div>
      <div className="billing-status">
        <div>
          <small>PAKET</small>
          <strong>
            {
              data.catalog.plans.find((p) => p.id === data.organization.plan)
                ?.name
            }
          </strong>
        </div>
        <div>
          <small>STATUS</small>
          <strong>
            {statusLabel[data.organization.subscription_status] ||
              data.organization.subscription_status}
          </strong>
        </div>
        <div>
          <small>
            {data.organization.subscription_status === "trialing"
              ? "TESTPHASE BIS"
              : "LAUFZEIT BIS"}
          </small>
          <strong>
            {date(
              data.organization.subscription_status === "trialing"
                ? data.organization.trial_ends_at
                : data.organization.period_ends_at,
            )}
          </strong>
        </div>
        <div>
          <small>AKTIVE MODULE</small>
          <strong>
            CORE
            {data.access.modules.length
              ? " + " + data.access.modules.join(", ").toUpperCase()
              : ""}
          </strong>
        </div>
      </div>
      {open && (
        <section className="panel panel-pad mb">
          <Badge>
            Offener Checkout ·{" "}
            {open.provider === "local_test" ? "Simulation" : "Stripe-Test"}
          </Badge>
          <h2>Bestellung überprüfen</h2>
          <p>
            {open.plan.toUpperCase()} · CORE
            {open.modules.map((m) => " + " + m.toUpperCase()).join("")}
          </p>
          <p className="checkout-total">
            {(
              (open.amount_cents / 100) *
              (1 - open.discount_percent / 100)
            ).toLocaleString("de-DE", {
              style: "currency",
              currency: "EUR",
            })}{" "}
            <small>/ Monat</small>
          </p>
          {open.discount_percent > 0 && (
            <p>
              {open.discount_percent}% Startrabatt
              {open.discount_months > 0
                ? ` für ${open.discount_months} Monate`
                : " innerhalb Ihrer bestehenden Rabattlaufzeit"}
              . Danach regulär{" "}
              {(open.amount_cents / 100).toLocaleString("de-DE")} € / Monat. Die
              bei Reservierung geltende Rabattlaufzeit bleibt erhalten.
            </p>
          )}
          <p>
            Die Modulrechte ändern sich erst nach bestätigter Zahlung. Lokale
            Tarifwechsel starten einen neuen simulierten Abrechnungsmonat;
            Stripe verrechnet Änderungen nach seinen Testrechnungen.
          </p>
          {owner && (
            <div className="page-actions">
              {open.provider === "stripe_test" && open.checkout_url && (
                <a className="button" href={open.checkout_url}>
                  Stripe-Testcheckout fortsetzen
                </a>
              )}
              {open.provider === "local_test" && (
                <ActionForm
                  submit="Testzahlung bestätigen"
                  onSubmit={() =>
                    action({ action: "confirm", orderId: open.id })
                  }
                >
                  <label className="checkbox-label">
                    <input required type="checkbox" />
                    Ich bestätige diese simulierte Zahlung ohne Geldeinzug.
                  </label>
                </ActionForm>
              )}
              <Button
                variant="secondary"
                onClick={() =>
                  run(
                    "billing",
                    { action: "abandon", orderId: open.id },
                    "POST",
                    "Offene Bestellung verworfen.",
                  )
                }
              >
                Bestellung verwerfen
              </Button>
            </div>
          )}
        </section>
      )}
      <section className="panel panel-pad mb">
        <h2>Paket und Module zusammenstellen</h2>
        <p>
          CORE ist immer enthalten. Alle Module sind während der Testphase
          verfügbar. Nach deren Ende gelten die bestätigten Buchungen.
        </p>
        <div className="plan-options">
          {data.catalog.plans.map((t) => (
            <button
              type="button"
              aria-pressed={plan === t.id}
              className={`plan-option ${plan === t.id ? "current" : ""}`}
              key={t.id}
              onClick={() => setPlan(t.id)}
            >
              <h3>{t.name}</h3>
              <strong>
                {t.corePrice} € <small>CORE / Monat</small>
              </strong>
              <p>
                {t.seats} Nutzer · {t.automations} Automationen · {t.aiDaily}{" "}
                KI-Anfragen/Tag
              </p>
              <small>
                {t.documentMB} MB Dokumente
                {t.customRoles ? " · Individuelle Rollen" : ""}
              </small>
            </button>
          ))}
        </div>
        <div className="module-options">
          {data.catalog.modules.map((m) => (
            <label className="checkbox-label" key={m.id}>
              <input
                type="checkbox"
                checked={modules.includes(m.id)}
                onChange={(e) =>
                  setModules(
                    e.target.checked
                      ? [...modules, m.id]
                      : modules.filter((v) => v !== m.id),
                  )
                }
              />
              <span>
                <strong>LYNO {m.name}</strong>
                <br />
                {m.description} · {m.price} € / Monat
              </span>
            </label>
          ))}
        </div>
        <div className="checkout-line">
          <div>
            <strong>{total.toLocaleString("de-DE")} € / Monat</strong>
            <p>
              {modules.length === 4
                ? "Gesamtbundle mit allen Modulen"
                : "Individuelle Modulauswahl"}{" "}
              · monatlich kündbar
            </p>
          </div>
          {owner && (
            <Button disabled={!!open} onClick={() => setReview(true)}>
              Auswahl buchen
            </Button>
          )}
        </div>
        {!owner && (
          <p>
            Nur Firmeninhaber können Bestellungen bestätigen und Abos ändern.
          </p>
        )}
      </section>
      <section className="panel panel-pad mb">
        <h2>Startrabatt im Testbetrieb</h2>
        <p>
          {data.campaign.enabled
            ? `${data.campaign.remaining} von ${data.campaign.capacity} Testplätzen aktuell frei. ${data.campaign.percent}% Rabatt für ${data.campaign.months} Monate für erstmalig zahlende Neukunden.`
            : "Die Startaktion ist derzeit pausiert."}
        </p>
        <p>
          Der Zähler basiert auf bestätigten Testzahlungen und offenen
          Reservierungen. Er stellt keine realen Kunden dar. Pro Neukunde
          einmal; lokale Reservierung 30 Minuten. Danach gilt der reguläre
          Preis. Bestehende Käufe und Reservierungen behalten ihre Konditionen.
        </p>
      </section>
      {owner && (
        <section className="panel panel-pad mb">
          <h2>Abonnement verwalten</h2>
          <p>
            {data.organization.cancel_at_period_end
              ? "Kündigung zum Laufzeitende vorgemerkt."
              : "Ihr Paket verlängert sich monatlich, bis Sie kündigen."}
          </p>
          <div className="page-actions">
            {["active", "trialing"].includes(
              data.organization.subscription_status,
            ) && (
              <Button
                variant="secondary"
                onClick={() =>
                  run(
                    "billing",
                    {
                      action: data.organization.cancel_at_period_end
                        ? "resume"
                        : "cancel",
                    },
                    "POST",
                    data.organization.cancel_at_period_end
                      ? "Kündigung zurückgenommen."
                      : "Kündigung vorgemerkt.",
                  )
                }
              >
                {data.organization.cancel_at_period_end
                  ? "Kündigung zurücknehmen"
                  : "Zum Laufzeitende kündigen"}
              </Button>
            )}
            {data.billingProvider === "stripe-test" && (
              <Button
                variant="secondary"
                onClick={() =>
                  action({ action: "portal" }).catch((e) =>
                    toast(e.message, true),
                  )
                }
              >
                Stripe-Testportal öffnen
              </Button>
            )}
          </div>
        </section>
      )}
      {owner && (
        <section className="panel">
          <div className="panel-heading">
            <h2>Abrechnungsverlauf</h2>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Paket</th>
                  <th>Testbetrag</th>
                  <th>Vorgang</th>
                </tr>
              </thead>
              <tbody>
                {data.billing.map((b) => (
                  <tr key={b.id}>
                    <td>{date(b.created_at)}</td>
                    <td>{b.plan}</td>
                    <td>
                      {(b.amount_cents / 100).toLocaleString("de-DE", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </td>
                    <td>
                      {b.kind.startsWith("local")
                        ? "Lokale Testzahlung"
                        : "Stripe-Testzahlung"}
                    </td>
                  </tr>
                ))}
                {!data.billing.length && (
                  <tr>
                    <td colSpan={4}>Noch keine bestätigten Testzahlungen.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {review && (
        <Modal title="Checkout vorbereiten" onClose={() => setReview(false)}>
          <ActionForm
            submit={
              data.billingProvider === "stripe-test"
                ? "Zum Stripe-Testcheckout"
                : "Bestellung vorbereiten"
            }
            onSubmit={async () => {
              await action({ action: "subscribe", plan, modules });
              setReview(false);
            }}
          >
            <Field label="Gewählte Konfiguration">
              <input
                readOnly
                value={`${p.name} · CORE${modules.length ? " + " + modules.join(", ").toUpperCase() : ""}`}
              />
            </Field>
            <p>
              {total} € / Monat vor einem möglichen Startrabatt. Die
              Reservierung und der verbindliche Testbetrag werden im nächsten
              Schritt geprüft.
            </p>
            <label className="checkbox-label">
              <input type="checkbox" required />
              Ich möchte den Abonnementablauf ausdrücklich im Testmodus
              durchspielen.
            </label>
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
