"use client";

import { Pencil, Tags, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  useCategories,
  useCreateCategory,
  useCurrentUser,
  useDeleteCategory,
  useUpdateCategory,
} from "@/shared/hooks/use-app-data";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Modal } from "@/shared/ui/modal";

type EditForm = { name: string };

export function CategoryManagement() {
  const currentUser = useCurrentUser();
  const categories = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  const createForm = useForm<{ name: string }>({ defaultValues: { name: "" } });
  const editForm = useForm<EditForm>({ defaultValues: { name: "" } });

  const onCreate = createForm.handleSubmit(async ({ name }) => {
    if (!currentUser.data?.id) return;
    try {
      await createCategory.mutateAsync({ name: name.trim(), createdByUserId: currentUser.data.id });
      createForm.reset({ name: "" });
      toast.success("Categoria criada");
      setOpenCreate(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a categoria.");
    }
  });

  const openEdit = (row: { id: string; name: string }) => {
    setEditing(row);
    editForm.reset({ name: row.name });
  };

  const onEdit = editForm.handleSubmit(async ({ name }) => {
    if (!editing) return;
    try {
      await updateCategory.mutateAsync({ id: editing.id, name: name.trim() });
      toast.success("Categoria atualizada");
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  });

  const onConfirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteCategory.mutateAsync(deleting.id);
      toast.success("Categoria excluída");
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  };

  const list = categories.data ?? [];
  const isLoading = categories.isLoading;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <CardTitle className="text-lg sm:text-xl">Lista</CardTitle>
          <Button className="w-full sm:w-auto" onClick={() => setOpenCreate(true)}>
            Nova categoria
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma categoria ainda.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border/80">
              {list.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-4"
                >
                  <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                    <Tags className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">{c.name}</span>
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" variant="ghost" size="icon" aria-label="Editar" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      aria-label="Excluir"
                      onClick={() => setDeleting(c)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Nova categoria" size="sm">
        <form onSubmit={onCreate} className="space-y-4">
          <div>
            <Label htmlFor="cat-create-name">Nome</Label>
            <Input id="cat-create-name" placeholder="Ex: Alimentação" {...createForm.register("name", { required: true })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createCategory.isPending}>
              {createCategory.isPending ? "Salvando…" : "Criar"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar categoria" size="sm">
        <form onSubmit={onEdit} className="space-y-4">
          <div>
            <Label htmlFor="cat-edit-name">Nome</Label>
            <Input id="cat-edit-name" {...editForm.register("name", { required: true })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateCategory.isPending}>
              {updateCategory.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Excluir categoria" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A categoria <span className="font-medium text-foreground">&quot;{deleting?.name}&quot;</span> será removida.
            Compras e recorrentes que usavam essa categoria ficarão sem categoria.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={onConfirmDelete} disabled={deleteCategory.isPending}>
              {deleteCategory.isPending ? "Excluindo…" : "Excluir"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
