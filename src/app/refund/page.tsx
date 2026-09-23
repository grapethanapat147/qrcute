import { LegalPage, legalMetadata } from "@/components/legal/legal-page";
import { REFUND } from "@/lib/legal";

export const metadata = legalMetadata(REFUND);

export default function Page() {
  return <LegalPage document={REFUND} />;
}
