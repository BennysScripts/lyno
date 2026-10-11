"use client";
import { useState } from "react";
import { useApp } from "./app-context";
import { ActionForm, Button, Field, Modal, roleLabel } from "./ui";
import type { CompanySettings, Permission } from "@/lib/customization";
const permissionLabels: Record<Permission, string> = {
  "flow.read": "Flow lesen",
  "flow.write": "Flow bearbeiten",
  "academy.read": "Wissen lesen",
  "academy.write": "Wissen bearbeiten",
  "assist.use": "Assist verwenden",
  "insights.read": "Auswertungen lesen",
  "core.manage": "Team verwalten",
};
async function logoData(file: File) {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 2000000
  )
    throw new Error("Bitte PNG, JPEG oder WebP bis 2 MB wählen.");
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/png");
}
export function CustomizationView() {
  const { data, admin, mutate, toast } = useApp();
  const [draft, setDraft] = useState<CompanySettings>(data.settings);
  function update<K extends keyof CompanySettings>(
    key: K,
    value: Partial<CompanySettings[K]>,
  ) {
    setDraft((d) => ({ ...d, [key]: { ...d[key], ...value } }));
  }
  return (
    <section className="panel panel-pad">
      <h2>Ein Arbeitsraum, der zu Ihnen passt.</h2>
      <p>
        Diese Vorgaben gelten nur für {data.organization.name}. Ihre
        persönlichen Ansichten bleiben unabhängig davon gespeichert.
      </p>
      {!admin ? (
        <p>
          Änderungen sind für Inhaber und berechtigte Administratoren verfügbar.
        </p>
      ) : (
        <ActionForm
          onSubmit={async () => {
            await mutate("customization", draft);
          }}
          submit="Firmenanpassungen speichern"
        >
          <div className="settings-grid">
            <fieldset>
              <legend>Branding und Startseite</legend>
              <Field label="Akzentfarbe">
                <input
                  type="color"
                  value={draft.branding.accent}
                  onChange={(e) =>
                    update("branding", { accent: e.target.value })
                  }
                />
              </Field>
              <Field label="Firmenlogo (PNG, JPEG, WebP)">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file)
                      try {
                        update("branding", { logo: await logoData(file) });
                      } catch (err) {
                        toast((err as Error).message, true);
                      }
                  }}
                />
              </Field>
              {draft.branding.logo && (
                <div className="logo-preview">
                  <img
                    src={draft.branding.logo}
                    alt="Vorschau Firmenlogo"
                    width={64}
                    height={64}
                  />
                  <Button
                    variant="secondary small"
                    onClick={() => update("branding", { logo: "" })}
                  >
                    Logo entfernen
                  </Button>
                </div>
              )}
              <Field label="Begrüßung">
                <input
                  maxLength={100}
                  value={draft.branding.tagline}
                  onChange={(e) =>
                    update("branding", { tagline: e.target.value })
                  }
                />
              </Field>
              <Field label="Startseite">
                <select
                  value={draft.dashboard.home}
                  onChange={(e) =>
                    update("dashboard", {
                      home: e.target
                        .value as CompanySettings["dashboard"]["home"],
                    })
                  }
                >
                  {[
                    ["overview", "Übersicht"],
                    ["flow", "Flow"],
                    ["academy", "Academy"],
                    ["assist", "Assist"],
                    ["insights", "Insights"],
                  ].map(([id, title]) => (
                    <option key={id} value={id}>
                      {title}
                    </option>
                  ))}
                </select>
              </Field>
              <p>Widgets auf der Übersicht</p>
              {[
                ["tasks", "Meine Aufgaben"],
                ["workflows", "Aktuelle Abläufe"],
                ["knowledge", "Wissen"],
                ["activity", "Aktivitäten"],
                ["stats", "Kennzahlen"],
              ].map(([id, label]) => (
                <label key={id} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={draft.dashboard.widgets.includes(
                      id as CompanySettings["dashboard"]["widgets"][number],
                    )}
                    onChange={(e) =>
                      update("dashboard", {
                        widgets: e.target.checked
                          ? [
                              ...draft.dashboard.widgets,
                              id as CompanySettings["dashboard"]["widgets"][number],
                            ]
                          : draft.dashboard.widgets.filter((v) => v !== id),
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Modulvorgaben</legend>
              <Field label="Flow: Standardansicht">
                <select
                  value={draft.flow.view}
                  onChange={(e) =>
                    update("flow", { view: e.target.value as "list" | "board" })
                  }
                >
                  <option value="list">Liste</option>
                  <option value="board">Board</option>
                </select>
              </Field>
              <Field label="Flow: Standardpriorität">
                <select
                  value={draft.flow.priority}
                  onChange={(e) =>
                    update("flow", {
                      priority: e.target
                        .value as CompanySettings["flow"]["priority"],
                    })
                  }
                >
                  {[
                    ["low", "Niedrig"],
                    ["normal", "Normal"],
                    ["high", "Hoch"],
                    ["urgent", "Dringend"],
                  ].map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Erinnerung vor Fälligkeit (Tage)">
                <input
                  type="number"
                  min={0}
                  max={14}
                  value={draft.flow.reminderDays}
                  onChange={(e) =>
                    update("flow", { reminderDays: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Academy: Begrüßung">
                <input
                  maxLength={250}
                  value={draft.academy.welcome}
                  onChange={(e) =>
                    update("academy", { welcome: e.target.value })
                  }
                />
              </Field>
              <Field label="Academy: Sortierung">
                <select
                  value={draft.academy.sort}
                  onChange={(e) =>
                    update("academy", {
                      sort: e.target.value as "updated" | "title",
                    })
                  }
                >
                  <option value="updated">Zuletzt aktualisiert</option>
                  <option value="title">Titel A–Z</option>
                </select>
              </Field>
              <Field label="Assist: Antwortumfang">
                <select
                  value={draft.assist.tone}
                  onChange={(e) =>
                    update("assist", {
                      tone: e.target.value as "concise" | "detailed",
                    })
                  }
                >
                  <option value="concise">Kompakt</option>
                  <option value="detailed">Ausführlich</option>
                </select>
              </Field>
              <Field
                label={`Assist: Tageslimit (maximal ${data.access.plan.aiDaily})`}
              >
                <input
                  type="number"
                  min={1}
                  max={data.access.plan.aiDaily}
                  value={draft.assist.dailyLimit}
                  onChange={(e) =>
                    update("assist", { dailyLimit: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Insights: Standardzeitraum (Tage)">
                <input
                  type="number"
                  min={7}
                  max={365}
                  value={draft.insights.days}
                  onChange={(e) =>
                    update("insights", { days: Number(e.target.value) })
                  }
                />
              </Field>
            </fieldset>
          </div>
        </ActionForm>
      )}
    </section>
  );
}
export function PersonalPreferences() {
  const { data, mutate } = useApp();
  return (
    <div className="mb">
      <h2>Benachrichtigungen</h2>
      <ActionForm
        submit="Benachrichtigungen speichern"
        onSubmit={async (fd) => {
          await mutate("preferences", {
            ...data.preferences,
            reminders: fd.get("reminders") === "on",
          });
        }}
      >
        <label className="checkbox-label">
          <input
            name="reminders"
            type="checkbox"
            defaultChecked={data.preferences.reminders}
          />
          Erinnerungen zu fälligen Aufgaben erhalten
        </label>
      </ActionForm>
    </div>
  );
}
export function RoleManager() {
  const { data, admin, mutate, run } = useApp();
  const [editing, setEditing] = useState<
    (typeof data.customRoles)[number] | null | false
  >(false);
  return (
    <>
      <section className="panel panel-pad mb">
        <div className="detail-heading">
          <h2>Individuelle Rollen</h2>
          {admin && data.access.plan.customRoles && (
            <Button onClick={() => setEditing(null)}>Rolle erstellen</Button>
          )}
        </div>
        <p>
          Individuelle Rollen begrenzen die Basisrolle. Sie können keine
          Inhaberrechte oder höhere Rechte verleihen. Bestehende Einschränkungen
          gelten auch nach einem Paketwechsel weiter.
        </p>
        {!data.access.plan.customRoles && (
          <p>
            Ab Business verfügbar.{" "}
            <a href="/app/settings?tab=billing">Pakete vergleichen</a>
          </p>
        )}
        {data.customRoles.map((r) => (
          <div className="role-row" key={r.id}>
            <div>
              <strong>{r.name}</strong>
              <p>
                {r.permissions.map((p) => permissionLabels[p]).join(" · ") ||
                  "Keine Modulrechte"}
              </p>
            </div>
            {admin && data.access.plan.customRoles && (
              <Button variant="secondary small" onClick={() => setEditing(r)}>
                Bearbeiten
              </Button>
            )}
          </div>
        ))}
      </section>
      <section className="panel panel-pad">
        <h2>Rollen zuweisen</h2>
        {data.members.map((m) => (
          <div className="role-row" key={m.id}>
            <div>
              <strong>{m.name}</strong>
              <p>Basis: {roleLabel[m.role]}</p>
            </div>
            <Field label={`Individuelle Rolle für ${m.name}`}>
              <select
                disabled={
                  !admin ||
                  m.role === "owner" ||
                  (!data.access.plan.customRoles && !m.custom_role_id)
                }
                value={m.custom_role_id || ""}
                onChange={(e) =>
                  run("roles/assign", {
                    userId: m.id,
                    roleId: e.target.value || null,
                  })
                }
              >
                <option value="">Nur Basisrolle</option>
                {data.customRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ))}
      </section>
      {editing !== false && (
        <Modal
          title={editing ? "Rolle bearbeiten" : "Rolle erstellen"}
          onClose={() => setEditing(false)}
        >
          <ActionForm
            onSubmit={async (fd) => {
              await mutate("roles", {
                id: editing?.id,
                name: fd.get("name"),
                permissions: fd.getAll("permissions"),
              });
              setEditing(false);
            }}
          >
            <Field label="Rollenname">
              <input
                name="name"
                minLength={2}
                maxLength={60}
                required
                defaultValue={editing?.name}
              />
            </Field>
            {Object.entries(permissionLabels).map(([id, label]) => (
              <label className="checkbox-label" key={id}>
                <input
                  type="checkbox"
                  name="permissions"
                  value={id}
                  defaultChecked={editing?.permissions.includes(
                    id as Permission,
                  )}
                  disabled={!data.permissions.includes(id as Permission)}
                />
                {label}
              </label>
            ))}
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
