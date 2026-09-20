import { useState } from "react";
import type { AffiliateProduct } from "./index";

export function AffiliateProductImage({
  product,
}: {
  product: Pick<AffiliateProduct, "imageUrl" | "title">;
}) {
  const [broken, setBroken] = useState(false);
  if (!product.imageUrl || broken) {
    return (
      <div className="tdg-aff-ph" aria-hidden="true">
        <span />
      </div>
    );
  }
  return (
    <img
      className="tdg-aff-img"
      src={product.imageUrl}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}
