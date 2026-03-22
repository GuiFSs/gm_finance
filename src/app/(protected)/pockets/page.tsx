import { PocketManagement } from "@/features/pockets/pocket-management";

export default function PocketsPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Caixinhas</h2>
      <PocketManagement />
    </div>
  );
}
