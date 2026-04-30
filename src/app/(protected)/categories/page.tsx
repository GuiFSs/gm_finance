import { CategoryManagement } from "@/features/categories/category-management";

export default function CategoriesPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Categorias</h2>
      <CategoryManagement />
    </div>
  );
}
