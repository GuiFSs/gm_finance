-- Cada compra (e suas parcelas) passa a ter um series_id próprio.
-- Evita agrupar/somar despesas diferentes só porque têm o mesmo título.

ALTER TABLE `purchases` ADD COLUMN `series_id` text;
--> statement-breakpoint
-- Dados existentes: cada linha é a própria série (novas compras parceladas
-- passam a compartilhar um series_id gerado na criação).
-- Nota: o reagrupamento correto das parcelas antigas fica na 0012.
UPDATE `purchases` SET `series_id` = `id` WHERE `series_id` IS NULL;
