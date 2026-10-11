"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="standalone">
      <p className="eyebrow">LYNO</p>
      <h1>Ein Moment, bitte.</h1>
      <p>
        Die Seite konnte nicht geladen werden. Prüfen Sie die
        Datenbankverbindung und versuchen Sie es erneut.
      </p>
      <button className="button" onClick={reset}>
        Erneut versuchen
      </button>
    </main>
  );
}
