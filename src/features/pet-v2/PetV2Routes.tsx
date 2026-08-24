import { useLocation } from "react-router-dom";
import { parsePetSpecies } from "../pet/catalog";
import { PetV2FunnelPage } from "./PetV2FunnelPage";

export function PetV2Route() {
  const { pathname } = useLocation();
  const species = parsePetSpecies(pathname.split("/")[2]);
  return <PetV2FunnelPage species={species} />;
}
