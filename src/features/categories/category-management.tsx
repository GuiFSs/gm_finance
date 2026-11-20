"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  useCategories,
  useCreateCategory,
  useCreatePocketCategory,
  useCurrentUser,
  useDeleteCategory,
  useDeletePocketCategory,
  usePocketCategories,
  useUpdateCategory,
  useUpdatePocketCategory,
} from "@/shared/hooks/use-app-data";
import { LedgerRow, LedgerSkeleton } from "@/features/month/ledger";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";
import { Field, FormActions, PageHeader } from "@/shared/ui/page-header";

type EditForm = { name: string };
type Kind = "purchase" | "pocket";

/** Textos de cada aba. Categorias de compra e de caixinha são listas separadas. */
const COPY: Record<
  Kind,
  {
    newTitle: string;
    placeholder: string;
    emptyText: string;
    emptyCta: string;
    noun: [string, string];
    deleteHint: string;
  }
> = {
  purchase: {
    newTitle: "nova categoria",
    placeholder: "Ex: Alimentação",
    emptyText: "Nenhuma categoria ainda.",
    emptyCta: "criar a primeira categoria",
    noun: ["categoria", "categorias"],
    deleteHint: "Compras e recorrentes que usavam essa categoria ficam sem categoria.",
  },
  pocket: {
    newTitle: "nova categoria de caixinha",
    placeholder: "Ex: Reservas",
    emptyText: "Nenhuma categoria de caixinha ainda.",
    emptyCta: "criar a primeira categoria",
    noun: ["categoria de caixinha", "categorias de caixinha"],
    deleteHint: "As caixinhas dessa categoria ficam sem categoria. Nenhuma caixinha é excluída.",
  },
};

export function CategoryManagement() {
  const currentUser = useCurrentUser();
  const [kind, setKind] = useState<Kind>("purchase");

  const categories = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const pocketCategories = usePocketCategories();
  const createPocketCategory = useCreatePocketCategory();
  const updatePocketCategory = useUpdatePocketCategory();
  const deletePocketCategory = useDeletePocketCategory();

  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  const createForm = useForm<{ name: string }>({ defaultValues: { name: "" } });
  const editForm = useForm<EditForm>({ defaultValues: { name: "" } });

  const copy = COPY[kind];
  const isPocket = kind === "pocket";
  const list = (isPocket ? pocketCategories.data : categories.data) ?? [];
  const isLoading = isPocket ? pocketCategories.isLoading : categories.isLoading;
  const isError = isPocket ? pocketCategories.isError : categories.isError;
  const creating = isPocket ? createPocketCategory.isPending : createCategory.isPending;
  const updating = isPocket ? updatePocketCategory.isPending : updateCategory.isPending;
  const deletingPending = isPocket ? deletePocketCategory.isPending : deleteCategory.isPending;

  const onCreate = createForm.handleSubmit(async ({ name }) => {
    if (!currentUser.data?.id) return;
    try {
      const payload = { name: name.trim(), createdByUserId: currentUser.data.id };
      if (isPocket) await createPocketCategory.mutateAsync(payload);
      else await createCategory.mutateAsync(payload);
      createForm.reset({ name: "" });
      toast.success(isPocket ? "Categoria de caixinha criada" : "Categoria criada");
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
      if (isPocket) await updatePocketCategory.mutateAsync({ id: editing.id, name: name.trim() });
      else await updateCategory.mutateAsync({ id: editing.id, name: name.trim() });
      toast.success("Categoria atualizada");
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  });

  const onConfirmDelete = async () => {
    if (!deleting) return;
    try {
      if (isPocket) await deletePocketCategory.mutateAsync(deleting.id);
      else await deleteCategory.mutateAsync(deleting.id);
      toast.success("Categoria excluída");
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  };

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

      <ToggleGroup
        type="single"
        value={kind}
        onValueChange={(v) => v && setKind(v as Kind)}
        aria-label="Tipo de categoria"
        className="mt-5 w-fit gap-0 border border-input"
      >
        <ToggleGroupItem value="purchase" className="h-8 px-3 data-[state=on]:bg-foreground data-[state=on]:text-background">
          compras
        </ToggleGroupItem>
        <ToggleGroupItem value="pocket" className="h-8 px-3 data-[state=on]:bg-foreground data-[state=on]:text-background">
          caixinhas
        </ToggleGroupItem>
      </ToggleGroup>

      {!isLoading && list.length > 0 ? (
        <p className="mt-4 text-[15px] text-muted-foreground tabular-nums">
          {list.length} {list.length === 1 ? copy.noun[0] : copy.noun[1]}
        </p>
      ) : null}

      {isLoading ? (
        <LedgerSkeleton />
      ) : isError ? (
        <p className="py-10 text-[15px] text-ink-out">Não foi possível carregar as categorias. Recarregue a página.</p>
      ) : list.length === 0 ? (
        <div className="space-y-4 py-10">
          <p className="text-[15px] text-muted-foreground">{copy.emptyText}</p>
          <Button onClick={() => setOpenCreate(true)} className="gap-2">
            <Plus aria-hidden />
            {copy.emptyCta}
          </Button>
        </div>
      ) : (
        <div className="mt-6 border-t-2 border-foreground">
          {sorted.map((c) => (
            <LedgerRow
              key={`${kind}-${c.id}`}
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

      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title={copy.newTitle} size="sm">
        <form onSubmit={onCreate} className="space-y-4">
          <Field label="Nome" htmlFor="cat-create-name">
            <Input id="cat-create-name" placeholder={copy.placeholder} {...createForm.register("name", { required: true })} />
          </Field>
          <FormActions>
            <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? "Salvando…" : "Criar"}
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
            <Button type="submit" disabled={updating}>
              {updating ? "Salvando…" : "Salvar"}
            </Button>
          </FormActions>
        </form>
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="excluir categoria?" size="sm">
        <div className="space-y-4">
          <p className="text-[15px] text-muted-foreground">
            <span className="font-medium text-foreground">{deleting?.name}</span> sai da lista. {copy.deleteHint}
          </p>
          <FormActions>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={onConfirmDelete} disabled={deletingPending}>
              {deletingPending ? "Excluindo…" : "Excluir"}
            </Button>
          </FormActions>
        </div>
      </Modal>
    </div>
  );
}
