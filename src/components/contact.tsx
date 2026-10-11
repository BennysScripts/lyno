"use client";
import { useState } from "react";
import { ActionForm, Field, api } from "./ui";
export function ContactForm() {
  const [message, setMessage] = useState("");
  return (
    <div className="contact-card">
      {message ? (
        <div className="success" role="status">
          {message}
        </div>
      ) : (
        <ActionForm
          submit="Anfrage lokal speichern"
          onSubmit={async (fd) => {
            const r = await api<{ message: string }>("contact", {
              name: fd.get("name"),
              email: fd.get("email"),
              message: fd.get("message"),
            });
            setMessage(r.message);
          }}
        >
          <h2>Was können wir für Sie tun?</h2>
          <Field label="Ihr Name">
            <input name="name" required minLength={2} autoComplete="name" />
          </Field>
          <Field label="E-Mail-Adresse">
            <input name="email" required type="email" autoComplete="email" />
          </Field>
          <Field label="Ihre Nachricht">
            <textarea
              name="message"
              required
              minLength={10}
              maxLength={5000}
              rows={6}
            />
          </Field>
          <small>
            Bitte übermitteln Sie keine Passwörter oder vertraulichen
            Kundendaten.
          </small>
        </ActionForm>
      )}
    </div>
  );
}
