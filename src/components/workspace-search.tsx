"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { ActionForm, api, Field, Modal } from "./ui";
export function GlobalSearch() {
  const [open, setOpen] = useState(false),
    [items, setItems] = useState<
      { id: string; title: string; kind: string; href: string }[] | null
    >(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return (
    <>
      <button
        className="global-search-trigger"
        aria-label="Global suchen"
        onClick={() => setOpen(true)}
      >
        <Search size={16} />
        <span>Aufgaben, Wissen und Personen suchen …</span>
        <kbd>⌘ K</kbd>
      </button>
      {open && (
        <Modal title="Im Arbeitsraum suchen" onClose={() => setOpen(false)}>
          <ActionForm
            submit="Suchen"
            onSubmit={async (fd) => {
              setItems(
                (
                  await api<{ items: NonNullable<typeof items> }>(
                    `search?q=${encodeURIComponent(String(fd.get("q")))}`,
                  )
                ).items,
              );
            }}
          >
            <Field label="Suchbegriff">
              <input
                autoFocus
                name="q"
                minLength={2}
                maxLength={120}
                required
                placeholder="Aufgaben, Abläufe, Wissen, Personen …"
              />
            </Field>
          </ActionForm>
          <div className="search-results" aria-live="polite">
            {items?.map((i) => (
              <Link
                key={`${i.kind}-${i.id}`}
                href={i.href}
                onClick={() => setOpen(false)}
              >
                <small>{i.kind}</small>
                <strong>{i.title}</strong>
              </Link>
            ))}
            {items?.length === 0 && (
              <p>Keine zugänglichen Ergebnisse gefunden.</p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
