"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  GitBranch,
  Send,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import type { TemplateInput } from "@/lib/flow";
import type { Insights } from "@/lib/types";
import { useApp } from "./app-context";
import { api, Badge, Button, Empty } from "./ui";
import { Stats } from "./workspace-dashboard";
type AssistResult = {
  answer: string;
  sources: { id: string; title: string; excerpt: string }[];
  draft?: TemplateInput;
  testMode: boolean;
  remaining: number;
};
export function AssistView() {
  const { data, refresh, manage, editTemplate } = useApp();
  const params = useSearchParams();
  const [mode, setMode] = useState(
    params.get("mode") === "summary" ? "summary" : "question",
  );
  const [article, setArticle] = useState(params.get("article") || "");
  const [prompt, setPrompt] = useState(
    params.get("article") ? "Fasse diesen Artikel zusammen." : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState<AssistResult | null>(null);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LYNO ASSIST</span>
          <h1>Eine Frage bringt Sie weiter.</h1>
          <p>
            Ihr Firmenwissen. Ihre Zugriffsrechte. Nachvollziehbare Quellen.
          </p>
        </div>
        <Badge tone={data.assist.testMode ? "orange" : "green"}>
          {data.assist.testMode ? "Lokaler Testmodus" : "KI-Anbieter aktiv"}
        </Badge>
      </div>
      <div className="assist-layout">
        <div className="assist-welcome">
          <div className="assist-orb">
            <MessageSquare size={28} />
          </div>
          <h2>Was möchten Sie heute klären?</h2>
          <p>
            Finden Sie Antworten in Ihrem Firmenwissen oder entwerfen Sie einen
            neuen Ablauf.
            <br />
            Sie behalten die Entscheidung über jeden nächsten Schritt.
          </p>
        </div>
        <div className="suggestion-grid">
          {[
            {
              icon: BookOpen,
              text: "Wie starten wir einen neuen Ablauf?",
              mode: "question",
            },
            {
              icon: MessageSquare,
              text: "Fasse unsere wichtigsten Arbeitsweisen zusammen.",
              mode: "summary",
            },
            {
              icon: GitBranch,
              text: "Erstelle einen Ablauf für die Projektübergabe.",
              mode: "draft",
            },
          ].map((s) => (
            <button
              key={s.text}
              onClick={() => {
                setPrompt(s.text);
                setMode(s.mode);
                setArticle("");
              }}
            >
              <s.icon />
              {s.text}
            </button>
          ))}
        </div>
        <form
          className="assist-input"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setBusy(true);
            try {
              const r = await api<AssistResult>("assist", {
                mode,
                prompt,
                ...(article ? { articleId: article } : {}),
              });
              setAnswer(r);
              await refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="sr-only" htmlFor="assist-prompt">
            Ihre Frage an Assist
          </label>
          <textarea
            id="assist-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            minLength={3}
            maxLength={3000}
            required
            placeholder="Stellen Sie eine Frage zu Ihrem Firmenwissen …"
          />
          <div className="assist-controls">
            <select
              aria-label="Assist-Funktion"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="question">Wissen befragen</option>
              <option value="summary">Zusammenfassen</option>
              <option value="draft">Ablauf entwerfen</option>
            </select>
            {mode === "summary" && (
              <select
                aria-label="Artikel zusammenfassen"
                value={article}
                onChange={(e) => setArticle(e.target.value)}
              >
                <option value="">Passende Artikel suchen</option>
                {data.articles.map((a) => (
                  <option value={a.id} key={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            )}
            <Button busy={busy} type="submit">
              {busy ? "Wird geprüft …" : "Anfrage senden"}
              <Send size={13} />
            </Button>
          </div>
          {error && (
            <p className="error" role="alert" style={{ marginTop: 15 }}>
              {error}
            </p>
          )}
        </form>
        <p className="assist-privacy">
          <ShieldCheck
            size={11}
            style={{ display: "inline", marginRight: 5 }}
          />
          {data.assist.testMode
            ? "Testmodus: lokale Originalauszüge und allgemeine Entwürfe, keine externe KI."
            : "Nur freigegebene Artikel werden an den konfigurierten KI-Anbieter übertragen."}{" "}
          · {data.assist.used}/{data.assist.limit} Anfragen heute
        </p>
        {answer && (
          <article className="assist-answer">
            <div className="panel-heading">
              <h2>Ihre Antwort</h2>
              <Badge tone={answer.testMode ? "orange" : "green"}>
                {answer.testMode
                  ? "Testmodus · bitte prüfen"
                  : "KI-generiert · bitte prüfen"}
              </Badge>
            </div>
            <div className="prose">
              <ReactMarkdown>{answer.answer}</ReactMarkdown>
            </div>
            {answer.sources.length > 0 && (
              <div className="source-list">
                {answer.sources.map((s, i) => (
                  <Link key={s.id} href={`/app/academy?id=${s.id}`}>
                    <BookOpen size={12} />
                    {i + 1}. {s.title}
                    <ArrowUpRight size={12} />
                  </Link>
                ))}
              </div>
            )}
            {answer.draft && (
              <div className="assist-draft">
                <h3>{answer.draft.name}</h3>
                <ol>
                  {answer.draft.steps.map((s, i) => (
                    <li key={i}>
                      {s.title}{" "}
                      {s.kind === "approval" && <Badge>Freigabe</Badge>}
                    </li>
                  ))}
                </ol>
                {manage ? (
                  <Button onClick={() => editTemplate(answer.draft)}>
                    Entwurf prüfen & bearbeiten <ArrowUpRight size={14} />
                  </Button>
                ) : (
                  <p className="muted">
                    Nur das Management kann diesen Entwurf als Vorlage
                    speichern.
                  </p>
                )}
              </div>
            )}
          </article>
        )}
      </div>
    </>
  );
}
export function InsightsView() {
  const { data, toast } = useApp();
  const [value, setValue] = useState<Insights>(data.insights);
  const [busy, setBusy] = useState(false);
  async function filter(days: string) {
    setBusy(true);
    try {
      setValue(await api<Insights>(`insights?days=${days}`));
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  const completion = value.summary.total
    ? Math.round((value.summary.completed / value.summary.total) * 100)
    : null;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LYNO INSIGHTS</span>
          <h1>Verstehen, was Arbeit bewegt.</h1>
          <p>
            Ihre Prozessdaten. Klar aufbereitet. Für die nächste gute
            Entscheidung.
          </p>
        </div>
        <select
          style={{ width: "auto", fontSize: 11, minHeight: 37 }}
          aria-label="Auswertungszeitraum"
          value={value.days}
          disabled={busy}
          onChange={(e) => filter(e.target.value)}
        >
          {![7, 30, 90, 365].includes(value.days) && (
            <option value={value.days}>Letzte {value.days} Tage</option>
          )}
          <option value={7}>Letzte 7 Tage</option>
          <option value={30}>Letzte 30 Tage</option>
          <option value={90}>Letzte 90 Tage</option>
          <option value={365}>Letztes Jahr</option>
        </select>
      </div>
      <div className="report-actions">
        <a
          className="button secondary"
          href={`/api/insights/report?days=${value.days}`}
          download
        >
          Bericht als CSV herunterladen
        </a>
      </div>
      <Stats insights={value} />
      <div className="insights-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Ihr Prozessrhythmus</h2>
              <p>
                Gestartete Abläufe je Tag und davon bereits abgeschlossene
                Abläufe
              </p>
            </div>
            <Badge tone="green">
              {completion === null
                ? "Noch keine Daten"
                : `${completion} % abgeschlossen`}
            </Badge>
          </div>
          <div
            className="chart-wrap"
            role="img"
            aria-label={`${value.summary.total} gestartete und ${value.summary.completed} abgeschlossene Abläufe in ${value.days} Tagen`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={value.weekly}
                margin={{ top: 8, right: 10, left: -24, bottom: 5 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--line)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(s) =>
                    new Date(s).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                    })
                  }
                  tick={{ fill: "var(--muted)", fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={35}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "var(--muted)", fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  labelFormatter={(v) =>
                    new Date(String(v)).toLocaleDateString("de-DE")
                  }
                />
                <Area
                  type="monotone"
                  dataKey="started"
                  name="Gestartet"
                  stroke="var(--accent)"
                  fill="var(--accent)"
                  fillOpacity={0.12}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="Davon abgeschlossen"
                  stroke="var(--muted)"
                  strokeDasharray="5 3"
                  fill="transparent"
                  strokeWidth={2}
                />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Wo Arbeit wartet</h2>
              <p>Aktuell bereite Schritte in offenen Abläufen</p>
            </div>
            <ClockIcon />
          </div>
          {value.bottlenecks.length ? (
            value.bottlenecks.slice(0, 4).map((b) => (
              <div className="bottleneck" key={b.title}>
                <div className="bottleneck-top">
                  <strong>{b.title}</strong>
                  <span>{b.count}</span>
                </div>
                <div className="bottleneck-bar">
                  <i
                    style={{
                      width: `${(b.count / Math.max(...value.bottlenecks.map((b) => b.count))) * 100}%`,
                    }}
                  />
                </div>
                <small>
                  Ø Prozessalter: {Number(b.age_days).toLocaleString("de-DE")}{" "}
                  Tage
                </small>
              </div>
            ))
          ) : (
            <Empty title="Keine wartenden Schritte">
              Sobald Abläufe gestartet sind, sehen Sie hier mögliche Engpässe.
            </Empty>
          )}
        </section>
      </div>
      <div className="panel">
        <div className="panel-heading">
          <h2>Prozesse im Vergleich</h2>
          <Badge>{value.days} Tage</Badge>
        </div>
        {value.processes.length ? (
          <div
            className="table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Datentabelle, horizontal scrollbar"
          >
            <table>
              <thead>
                <tr>
                  <th>PROZESS</th>
                  <th>GESTARTET</th>
                  <th>ABGESCHLOSSEN</th>
                  <th>ABSCHLUSSQUOTE</th>
                  <th>Ø DAUER</th>
                </tr>
              </thead>
              <tbody>
                {value.processes.map((p) => (
                  <tr key={p.name}>
                    <td>
                      <strong>{p.name}</strong>
                    </td>
                    <td>{p.total}</td>
                    <td>{p.completed}</td>
                    <td>
                      {p.total ? Math.round((p.completed / p.total) * 100) : 0}{" "}
                      %
                    </td>
                    <td>
                      {p.avg_hours === null
                        ? "—"
                        : `${Number(p.avg_hours).toLocaleString("de-DE")} Std.`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Ihre ersten Daten entstehen mit dem ersten Ablauf" />
        )}
      </div>
      <p className="muted" style={{ fontSize: 10, marginTop: 17 }}>
        Auswertung nach Startdatum. Durchlaufzeit vom Start bis zum Abschluss;
        abgebrochene Abläufe zählen nicht zur Durchschnittsdauer. Prozessalter
        ist die Zeit seit Prozessstart, keine gemessene Liegezeit eines
        einzelnen Schritts.
      </p>
    </>
  );
}
function ClockIcon() {
  return <ChartNoAxesCombined size={17} className="muted" />;
}
