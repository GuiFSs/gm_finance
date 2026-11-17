"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useCreateTag, useCurrentUser } from "@/shared/hooks/use-app-data";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SelectOptions } from "@/shared/ui/select-options";

const CREATE = "__create__";

type Props = {
  tags: Array<{ id: string; name: string }>;
  value: string;
  onChange: (tagId: string) => void;
  excludeIds?: string[];
  id?: string;
};

export function TagPickerField({ tags, value, onChange, excludeIds = [], id }: Props) {
  const currentUser = useCurrentUser();
  const createTag = useCreateTag();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const options = [
    { value: "", label: "Escolha a tag" },
    ...tags
      .filter((t) => t.id === value || !excludeIds.includes(t.id))
      .map((t) => ({ value: t.id, label: t.name })),
    { value: CREATE, label: "+ nova tag" },
  ];

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || !currentUser.data?.id) return;
    try {
      const result = await createTag.mutateAsync({
        name,
        createdByUserId: currentUser.data.id,
      });
      const created = (result as { data: { id: string } }).data;
      onChange(created.id);
      setNewName("");
      setShowCreate(false);
      toast.success("Tag criada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar tag");
    }
  };

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="sr-only">
        Tag
      </Label>
      <SelectOptions
        id={id}
        aria-label="Tag"
        value={value}
        onValueChange={(v) => (v === CREATE ? setShowCreate(true) : onChange(v))}
        options={options}
      />
      {showCreate ? (
        <div className="flex flex-col gap-2 pt-1 sm:flex-row">
          <Input
            aria-label="Nome da nova tag"
            placeholder="Nome da tag"
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
              disabled={createTag.isPending || !newName.trim()}
            >
              {createTag.isPending ? "Criando..." : "Criar"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
