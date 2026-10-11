import { Logo, LinkButton } from "@/components/ui";
export default function NotFound() {
  return (
    <main id="main" className="standalone">
      <Logo />
      <p className="eyebrow">404 · KURZ VERLAUFEN</p>
      <h1>Hier geht es nicht weiter.</h1>
      <p>Diese Seite existiert nicht oder wurde verschoben.</p>
      <LinkButton href="/">Zur Startseite</LinkButton>
    </main>
  );
}
