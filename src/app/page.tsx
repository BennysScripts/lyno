import { Marketing } from "@/components/marketing";
import { catalog } from "@/lib/catalog";
import { campaignStatus } from "@/lib/discount";
import { transaction } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Home() {
  return (
    <Marketing
      config={catalog()}
      campaign={await transaction(campaignStatus)}
      mailMode={process.env.MAIL_MODE || "local"}
    />
  );
}
