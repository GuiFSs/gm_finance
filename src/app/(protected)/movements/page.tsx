import { Suspense } from "react";

import { MovementsList } from "@/features/movements/movements-list";

export default function MovementsPage() {
  return (
    <Suspense fallback={null}>
      <MovementsList />
    </Suspense>
  );
}
