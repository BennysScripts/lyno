"use client";
import {
  useEffect,
  useRef,
  useState,
  useId,
  isValidElement,
  cloneElement,
  type ReactElement,
  type ReactNode,
  type FormEvent,
} from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Loader2, Moon, Sun, X } from "lucide-react";
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <Link
      href="/"
      className={`logo ${small ? "small" : ""}`}
      aria-label="LYNO Startseite"
    >
      Lyno
    </Link>
  );
}
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);
  return (
    <button
      className="icon-button"
      aria-label={dark ? "Hellen Modus aktivieren" : "Dunklen Modus aktivieren"}
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.dataset.theme = next ? "dark" : "light";
        localStorage.setItem("lyno-theme", next ? "dark" : "light");
      }}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
export function Button({
  children,
  variant = "",
  busy = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: string;
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={busy || props.disabled}
      className={`button ${variant} ${props.className || ""}`}
    >
      {busy && <Loader2 size={16} className="spin" />}
      {children}
    </button>
  );
}
export function LinkButton({
  href,
  children,
  variant = "",
}: {
  href: string;
  children: ReactNode;
  variant?: string;
}) {
  return (
    <Link className={`button ${variant}`} href={href}>
      {children}
    </Link>
  );
}
export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const generated = useId();
  const child = children as ReactElement<{
    id?: string;
    "aria-describedby"?: string;
  }>;
  const id =
    isValidElement(child) && child.props.id ? child.props.id : generated;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isValidElement(child)
        ? cloneElement(child, {
            id,
            "aria-describedby": hint ? `${id}-hint` : undefined,
          })
        : children}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <span aria-hidden="true">—</span>
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Dialog schließen"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ActionForm({
  children,
  onSubmit,
  submit = "Speichern",
  className = "",
}: {
  children: ReactNode;
  onSubmit: (data: FormData) => Promise<void>;
  submit?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function handle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onSubmit(new FormData(e.currentTarget));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={`form-stack ${className}`} onSubmit={handle}>
      {children}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" busy={busy}>
        {submit}
        <ArrowUpRight size={17} />
      </Button>
    </form>
  );
}
export const date = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString("de-DE", {
        timeZone: "Europe/Berlin",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Ohne Frist";
export const dateInput = (value: string | null | undefined) =>
  value ? value.slice(0, 10) : "";
export const isoDate = (value: FormDataEntryValue | null) =>
  value ? new Date(String(value) + "T12:00:00Z").toISOString() : null;
export const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
export const roleLabel: Record<string, string> = {
  owner: "Inhaber",
  admin: "Admin",
  manager: "Management",
  member: "Mitglied",
  viewer: "Lesend",
};
export const statusLabel: Record<string, string> = {
  active: "In Bearbeitung",
  completed: "Abgeschlossen",
  canceled: "Abgebrochen",
  ready: "Bereit",
  pending: "Wartet",
  done: "Erledigt",
  skipped: "Übersprungen",
  rejected: "Abgelehnt",
  trialing: "Testphase",
  past_due: "Zahlung ausstehend",
};
export const priorityLabel: Record<string, string> = {
  low: "Niedrig",
  normal: "Normal",
  high: "Hoch",
  urgent: "Dringend",
};
export function CheckLine({ children }: { children: ReactNode }) {
  return (
    <span className="check-line">
      <Check size={16} />
      {children}
    </span>
  );
}
export async function api<T = Record<string, unknown>>(
  path: string,
  body?: unknown,
  method = body ? "POST" : "GET",
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 428 && typeof window !== "undefined")
      window.location.href = "/einrichten";
    if (
      response.status === 401 &&
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/app")
    )
      window.location.href = "/anmelden";
    throw new Error(data.error || "Die Anfrage ist fehlgeschlagen.");
  }
  return data;
}
