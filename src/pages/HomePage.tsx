import { useNavigate } from "react-router-dom";
import MainPage from "../components/MainPage";
import { PageHead } from "../components/PageHead";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <>
      <PageHead
        title="Create AI Christmas Cards"
        description="Generate beautiful, personalized holiday cards and videos using AI. Choose templates, upload family photos, and create professional results in seconds."
      />
      <MainPage
        onStartCreating={() => void navigate("/generator")}
        onViewTemplates={() => void navigate("/templates")}
        createHref="/generator"
      />
    </>
  );
}
