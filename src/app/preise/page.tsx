import { MarketingNav, MarketingFooter } from "@/components/marketing";
import { Pricing } from "@/components/pricing";
import { catalog } from "@/lib/catalog";
import { campaignStatus } from "@/lib/discount";
import { transaction } from "@/lib/db";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Preise & Pakete",
  description:
    "Starter, Business und Premium. CORE als Basis, Module einzeln oder als Bundle.",
};
export default async function Prices() {
  return (
    <>
      <MarketingNav />
      <main id="main">
        <Pricing
          config={catalog()}
          campaign={await transaction(campaignStatus)}
        />
      </main>
      <MarketingFooter />
    </>
  );
}
