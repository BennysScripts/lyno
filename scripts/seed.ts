import bcrypt from "bcryptjs";
import { query, transaction, rows, pool } from "../src/lib/db";
import { bootstrap } from "../src/lib/core";
import { startWorkflow, taskAction } from "../src/lib/flow";
import { saveArticle } from "../src/lib/academy";
import type { Context } from "../src/lib/security";
try {
  if (
    (await query("SELECT id FROM users WHERE email=$1", ["lea@lyno.example"]))
      .length
  ) {
    console.log("Beispielkonto bereits vorhanden. Keine Daten verändert.");
  } else
    await transaction(async (db) => {
      const pw = await bcrypt.hash("Lyno-Demo-2026!", 12);
      const [user] = await rows(
        db,
        "INSERT INTO users(email,name,password_hash,email_verified_at) VALUES('lea@lyno.example','Lea Mustermann',$1,now()) RETURNING id",
        [pw],
      );
      const [org] = await rows(
        db,
        "INSERT INTO organizations(name,is_demo,plan) VALUES('Nordlicht Studio',true,'business') RETURNING id",
      );
      await db.query(
        "INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'owner')",
        [org.id, user.id],
      );
      await db.query("SELECT set_config('app.tenant_id',$1,true)", [org.id]);
      const ctx: Context = {
        tenantId: org.id,
        userId: user.id,
        role: "owner",
        name: "Lea Mustermann",
        email: "lea@lyno.example",
        verified: true,
        sessionHash: "",
      };
      await bootstrap(db, ctx);
      const colleagues = [];
      for (const [email, name, role] of [
        ["tim@lyno.example", "Tim Krämer", "manager"],
        ["mira@lyno.example", "Mira Neumann", "member"],
        ["jonas@lyno.example", "Jonas Weber", "member"],
        ["eva@lyno.example", "Eva Sommer", "viewer"],
      ]) {
        const [u] = await rows(
          db,
          "INSERT INTO users(email,name,password_hash,email_verified_at) VALUES($1,$2,$3,now()) RETURNING id",
          [email, name, pw],
        );
        await db.query(
          "INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,$3)",
          [org.id, u.id, role],
        );
        colleagues.push(u.id);
      }
      const [team] = await rows(
        db,
        "INSERT INTO teams(tenant_id,name) VALUES($1,'Projektteam') RETURNING id",
        [org.id],
      );
      for (const id of [user.id, ...colleagues.slice(0, 3)])
        await db.query(
          "INSERT INTO team_members(tenant_id,team_id,user_id) VALUES($1,$2,$3)",
          [org.id, team.id, id],
        );
      const [category] = await rows(
        db,
        "INSERT INTO categories(tenant_id,name) VALUES($1,'Zusammenarbeit') RETURNING id",
        [org.id],
      );
      const articles = [
        {
          title: "Unser Kunden-Onboarding",
          body: "# Ein guter Start ist Teamarbeit\n\n**Beispielinhalt:** Passen Sie diesen Ablauf vor der Verwendung an Ihr Unternehmen an.\n\n## 1. Gemeinsam ausrichten\n\nIm Kick-off klären wir Ziele, Verantwortlichkeiten und den Zeitplan. Alle Entscheidungen werden im zugehörigen Flow-Ablauf dokumentiert.\n\n## 2. Sicher zusammenarbeiten\n\nZugänge erhalten nur die Personen, die sie für ihre Arbeit brauchen. Passwörter gehören in einen Passwortmanager, niemals in Kommentare.\n\n## 3. Bewusst übergeben\n\nZum Abschluss prüft das Management, ob alle Voraussetzungen erfüllt sind. Erst dann wird das Onboarding freigegeben.",
        },
        {
          title: "Projektübergabe ohne offene Enden",
          body: "# Übergaben, die funktionieren\n\n**Beispielinhalt für die Erprobung.**\n\nEine gute Übergabe beantwortet vier Fragen:\n\n- Was wurde vereinbart und bereits geliefert?\n- Was ist noch offen?\n- Wer übernimmt die nächsten Schritte?\n- Wo liegen die relevanten Dokumente?\n\n## Unser Vorgehen\n\nErstellen Sie einen Ablauf in Flow. Dokumentieren Sie offene Punkte als Kommentar und verknüpfen Sie die relevanten Wissensartikel. Die abschließende Freigabe übernimmt das Management.",
        },
        {
          title: "Qualität ist ein gemeinsamer Prozess",
          body: "# Verlässlich gute Ergebnisse\n\n**Beispielinhalt.** Prüfkriterien müssen projektspezifisch festgelegt werden.\n\n## Vor der Auslieferung\n\n1. Anforderungen mit dem Ergebnis abgleichen.\n2. Funktion, Darstellung und Berechtigungen prüfen.\n3. Abweichungen dokumentieren und korrigieren.\n4. Ergebnis durch eine verantwortliche Person freigeben.\n\nNutzen Sie die Flow-Vorlage Qualitätsprüfung, damit kein Schritt verloren geht.",
        },
      ];
      const saved = [];
      for (const a of articles)
        saved.push(
          await saveArticle(db, ctx, { ...a, categoryId: category.id }),
        );
      await saveArticle(db, ctx, {
        title: "Vertrauliche Managementnotizen",
        body: "# Management\n\nDieser Beispielartikel ist ausschließlich für Inhaber, Admins und Management sichtbar. Mitglieder und lesende Konten dürfen ihn auch über Assist nicht abrufen.",
        visibility: "managers",
        categoryId: category.id,
      });
      const templates = await rows(
        db,
        "SELECT * FROM templates WHERE tenant_id=$1 ORDER BY created_at",
        [org.id],
      );
      const names = [
        "Küstenwerk · Kunden-Onboarding",
        "Studio Morgen · Qualitätsprüfung",
        "Neue Design-Software · Freigabe",
        "Hafen Digital · Onboarding",
        "Website-Launch · Qualitätsprüfung",
        "Team-Offsite · Interne Freigabe",
        "Nordstern · Kunden-Onboarding",
        "Portal-Release · Qualitätsprüfung",
        "Hardware-Bestellung · Freigabe",
        "Sommerwind · Kunden-Onboarding",
        "Brand-Refresh · Qualitätsprüfung",
        "Fortbildung · Freigabe",
      ];
      for (let i = 0; i < names.length; i++) {
        const t = templates[i % templates.length];
        const values: Record<string, unknown> = {
          kunde: names[i].split(" · ")[0],
          zugang: i % 2 === 0,
          projekt: names[i].split(" · ")[0],
          anliegen: names[i],
          betrag: 450,
        };
        const w = await startWorkflow(db, ctx, {
          templateId: t.id,
          name: names[i],
          priority: i % 4 === 0 ? "high" : "normal",
          dueAt: new Date(Date.now() + ((i % 5) - 1) * 86400000).toISOString(),
          formData: values,
        });
        const age = i < 5 ? i + 1 : 7 + (i - 5) * 2;
        await db.query(
          "UPDATE workflows SET created_at=now()-$3*interval '1 day' WHERE tenant_id=$1 AND id=$2",
          [org.id, w.id, age],
        );
        if (i >= 5) {
          let next;
          while (
            (next = (
              await rows(
                db,
                "SELECT id FROM tasks WHERE tenant_id=$1 AND workflow_id=$2 AND status='ready' LIMIT 1",
                [org.id, w.id],
              )
            )[0])
          )
            await taskAction(db, ctx, next.id, { action: "complete" });
          await db.query(
            "UPDATE workflows SET completed_at=created_at+($3*interval '1 hour') WHERE tenant_id=$1 AND id=$2",
            [org.id, w.id, 12 + i * 4],
          );
        } else {
          const tasks = await rows(
            db,
            "SELECT id FROM tasks WHERE tenant_id=$1 AND workflow_id=$2 ORDER BY position",
            [org.id, w.id],
          );
          if (i % 2 === 0)
            await taskAction(db, ctx, tasks[0].id, { action: "complete" });
          await db.query(
            "UPDATE tasks SET assignee_id=$3,due_at=now()+$4*interval '1 day' WHERE tenant_id=$1 AND workflow_id=$2 AND status='ready'",
            [org.id, w.id, i % 2 ? colleagues[1] : user.id, i === 0 ? -1 : 2],
          );
        }
      }
      for (let i = 0; i < saved.length; i++)
        await db.query(
          "INSERT INTO checklist_items(tenant_id,title,article_id,template_id) VALUES($1,$2,$3,$4)",
          [
            org.id,
            [
              "Unser Kunden-Onboarding verstehen",
              "Die erste Projektübergabe vorbereiten",
              "Qualitätsanspruch kennenlernen",
            ][i],
            saved[i].id,
            templates[i].id,
          ],
        );
      console.log(
        "Fiktives Beispielunternehmen angelegt. Login: lea@lyno.example / Lyno-Demo-2026!",
      );
    });
} finally {
  await pool.end();
}
