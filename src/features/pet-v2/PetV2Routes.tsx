import { useLocation } from "react-router-dom";
import { parsePetV2Species } from "./analytics";
import { PetV2FunnelPage } from "./PetV2FunnelPage";

export function PetV2Route() {
  const { pathname } = useLocation();
  return <PetV2FunnelPage species={parsePetV2Species(pathname)} />;
}
