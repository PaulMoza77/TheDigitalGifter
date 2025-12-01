import GeneratorPage from "@/domains/generator/components/Generator";
import { PageHead } from "@/components/PageHead";

export default function GeneratorPageWrapper() {
  return (
    <>
      <PageHead
        title="AI Christmas Card Generator"
        description="Upload your photos and customize AI-powered holiday cards. Choose from festive templates and generate stunning personalized cards instantly."
      />
      <GeneratorPage />
    </>
  );
}
