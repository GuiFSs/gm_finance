import { PocketManagement } from "@/features/pockets/pocket-management";

export default function PocketsPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Caixinhas</h2>
      <PocketManagement />
    </div>
  );
}
