import { LegalPage, legalMetadata } from "@/components/legal/legal-page";
import { PRIVACY } from "@/lib/legal";

export const metadata = legalMetadata(PRIVACY);

export default function Page() {
  return <LegalPage document={PRIVACY} />;
}
