import { Suspense } from "react";

import { PurchaseList } from "@/features/purchases/purchase-list";

export default function PurchasesPage() {
  return (
    <Suspense fallback={null}>
      <PurchaseList />
    </Suspense>
  );
}
