"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useCreateCategory, useCurrentUser } from "@/shared/hooks/use-app-data";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SelectOptions } from "@/shared/ui/select-options";

const CREATE = "__create__";

type Props = {
  categories: Array<{ id: string; name: string }>;
  value: string;
  onChange: (categoryId: string) => void;
  excludeIds?: string[];
  id?: string;
};

export function CategoryPickerField({ categories, value, onChange, excludeIds = [], id }: Props) {
  const currentUser = useCurrentUser();
  const createCategory = useCreateCategory();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const options = [
    { value: "", label: "Escolha a categoria" },
    ...categories
      .filter((c) => c.id === value || !excludeIds.includes(c.id))
      .map((c) => ({ value: c.id, label: c.name })),
    { value: CREATE, label: "+ nova categoria" },
  ];

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || !currentUser.data?.id) return;
    try {
      const result = await createCategory.mutateAsync({
        name,
        createdByUserId: currentUser.data.id,
      });
      const created = result.data;
      onChange(created.id);
      setNewName("");
      setShowCreate(false);
      toast.success("Categoria criada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar categoria");
    }
  };

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="sr-only">
        Categoria
      </Label>
      <SelectOptions
        id={id}
        aria-label="Categoria"
        value={value}
        onValueChange={(v) => (v === CREATE ? setShowCreate(true) : onChange(v))}
        options={options}
      />
      {showCreate ? (
        <div className="flex flex-col gap-2 pt-1 sm:flex-row">
          <Input
            aria-label="Nome da nova categoria"
            placeholder="Nome da categoria"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreate())}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowCreate(false);
                setNewName("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCreate}
              disabled={createCategory.isPending || !newName.trim()}
            >
              {createCategory.isPending ? "Criando..." : "Criar"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
