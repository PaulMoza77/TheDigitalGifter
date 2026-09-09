import { Navigate, useLocation } from "react-router-dom";
import { giftFinderCanonicalFromLegacy } from "./hubIa";

/** /christmas/gifts is reserved for Gift Tree — never render Gift Finder here. */
export function GiftFinderLegacyRedirect() {
  const { search } = useLocation();
  return <Navigate to={giftFinderCanonicalFromLegacy(search)} replace />;
}
