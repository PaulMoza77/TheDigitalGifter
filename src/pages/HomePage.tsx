import { useNavigate } from "react-router-dom";
import MainPage from "../components/MainPage";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <MainPage
      onStartCreating={() => void navigate("/generator")}
      onViewTemplates={() => void navigate("/templates")}
      createHref="/generator"
    />
  );
}
