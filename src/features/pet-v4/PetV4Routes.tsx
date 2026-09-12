import { useLocation } from "react-router-dom";
import { parsePetV4Species } from "./campaign";
import { PetV4FunnelPage } from "./PetV4FunnelPage";

export function PetV4Route() {
  const { pathname } = useLocation();
  return <PetV4FunnelPage species={parsePetV4Species(pathname)} />;
}
