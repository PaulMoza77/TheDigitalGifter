import TemplatesGrid from "@/components/TemplatesGrid";
import { PageHead } from "@/components/PageHead";
import { useLocation, useNavigate } from "react-router-dom";
import { TemplateSummary } from "@/types/templates";

export default function TemplatesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const occasionParam = params.get("occasion");

  // Navigate to generator page with template ID and its occasion
  const handleTemplatePick = (template: TemplateSummary) => {
    const urlParams = new URLSearchParams();
    // Use template's occasion, or fallback to current filter occasion
    const occasion = template.occasion?.toLowerCase().trim() || occasionParam;
    if (occasion) urlParams.set("occasion", occasion);
    urlParams.set("template", template._id);
    navigate(`/generator?${urlParams.toString()}`);
  };

  return (
    <>
      <PageHead
        title="Browse Holiday Card Templates"
        description="Explore our collection of professionally designed AI-powered holiday card templates. Find the perfect design for your personalized Christmas greeting."
      />
      <div className="min-h-screen bg-gradient-to-br from-[#060a12] via-[#0b1220] to-[#0a0f1a] relative overflow-x-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[#ff4d4d]/5 via-transparent to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-[#2dd4bf]/5 via-transparent to-transparent rounded-full blur-3xl"></div>
        </div>

        {/* Main content */}
        <div className="relative z-10">
          {/* Header section */}
          <div className="px-4 pt-6 md:pt-10 ">
            <div className="max-w-7xl mx-auto">
              <div className="space-y-2">
                <h2 className="text-3xl md:text-5xl font-extrabold text-[#fffef5]">
                  Holiday Card Templates
                </h2>
                <p className="text-[#c1c8d8] max-w-2xl">
                  Browse our curated collection of professionally designed
                  templates. Each template is optimized for AI generation with
                  your personal touch.
                </p>
              </div>
            </div>
          </div>

          {/* Templates section */}
          <div className="px-4 py-8 md:py-12">
            <div className="max-w-7xl mx-auto">
              <TemplatesGrid
                occasionFilter={occasionParam}
                onPick={handleTemplatePick}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
