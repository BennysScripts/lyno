import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getContext } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { state } from "@/lib/state";
import { AppError } from "@/lib/security";
import { Workspace } from "@/components/workspace";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Arbeitsraum",
  robots: { index: false, follow: false },
};
export default async function AppPage({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{ id?: string; overview?: string }>;
}) {
  const view = (await params).section?.join("/") || "";
  if (
    ![
      "",
      "flow",
      "academy",
      "learning",
      "assist",
      "insights",
      "team",
      "settings",
      "audit",
      "notifications",
    ].includes(view)
  )
    notFound();
  let ctx;
  try {
    ctx = await getContext((await cookies()).get("lyno_session")?.value);
  } catch (e) {
    if (e instanceof AppError && e.status === 401) redirect("/anmelden");
    if (e instanceof AppError && e.status === 428) redirect("/einrichten");
    throw e;
  }
  const selected = (await searchParams).id;
  const initial = await transaction(
    (db) => state(db, ctx, view === "flow" ? selected : undefined),
    ctx.tenantId,
  );
  const home = initial.settings.dashboard.home;
  if (
    !view &&
    !(await searchParams).overview &&
    home !== "overview" &&
    initial.access.modules.includes(home) &&
    initial.permissions.includes(
      home === "assist" ? "assist.use" : `${home}.read`,
    )
  )
    redirect(`/app/${home}`);
  return (
    <Workspace initial={JSON.parse(JSON.stringify(initial))} view={view} />
  );
}
