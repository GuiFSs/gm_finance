"use client";

import { Plus, Trash2 } from "lucide-react";
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
import { LedgerRow, LedgerSkeleton } from "@/features/month/ledger";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { Field, FormActions, PageHeader } from "@/shared/ui/page-header";

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

  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));

  return (
    <div className="pb-4">
      <PageHeader
        title="categorias"
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setOpenCreate(true)}>
            <Plus aria-hidden />
            nova
          </Button>
        }
      />
      {!isLoading && list.length > 0 ? (
        <p className="mt-2 text-[15px] text-muted-foreground tabular-nums">
          {list.length} {list.length === 1 ? "categoria" : "categorias"}
        </p>
      ) : null}

      {isLoading ? (
        <LedgerSkeleton />
      ) : categories.isError ? (
        <p className="py-10 text-[15px] text-ink-out">Não foi possível carregar as categorias. Recarregue a página.</p>
      ) : list.length === 0 ? (
        <div className="space-y-4 py-10">
          <p className="text-[15px] text-muted-foreground">Nenhuma categoria ainda.</p>
          <Button onClick={() => setOpenCreate(true)} className="gap-2">
            <Plus aria-hidden />
            criar a primeira categoria
          </Button>
        </div>
      ) : (
        <div className="mt-6 border-t-2 border-foreground">
          {sorted.map((c) => (
            <LedgerRow
              key={c.id}
              tile={null}
              title={c.name}
              amount={null}
              onOpen={() => openEdit(c)}
              openLabel={`Renomear ${c.name}`}
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="-mr-2 text-muted-foreground hover:text-ink-out"
                  aria-label={`Excluir ${c.name}`}
                  onClick={() => setDeleting(c)}
                >
                  <Trash2 />
                </Button>
              }
            />
          ))}
        </div>
      )}

      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="nova categoria" size="sm">
        <form onSubmit={onCreate} className="space-y-4">
          <Field label="Nome" htmlFor="cat-create-name">
            <Input id="cat-create-name" placeholder="Ex: Alimentação" {...createForm.register("name", { required: true })} />
          </Field>
          <FormActions>
            <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createCategory.isPending}>
              {createCategory.isPending ? "Salvando…" : "Criar"}
            </Button>
          </FormActions>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="renomear categoria" size="sm">
        <form onSubmit={onEdit} className="space-y-4">
          <Field label="Nome" htmlFor="cat-edit-name">
            <Input id="cat-edit-name" {...editForm.register("name", { required: true })} />
          </Field>
          <FormActions>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateCategory.isPending}>
              {updateCategory.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </FormActions>
        </form>
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="excluir categoria?" size="sm">
        <div className="space-y-4">
          <p className="text-[15px] text-muted-foreground">
            <span className="font-medium text-foreground">{deleting?.name}</span> sai da lista. Compras e recorrentes que
            usavam essa categoria ficam sem categoria.
          </p>
          <FormActions>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={onConfirmDelete} disabled={deleteCategory.isPending}>
              {deleteCategory.isPending ? "Excluindo…" : "Excluir"}
            </Button>
          </FormActions>
        </div>
      </Modal>
    </div>
  );
}
