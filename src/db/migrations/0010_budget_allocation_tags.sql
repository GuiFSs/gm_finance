-- Subdivisões do orçamento passam a usar tag_id (em vez de label texto livre).

-- Cria tags a partir de labels existentes que ainda não existem na tabela tags
INSERT INTO `tags` (`id`, `name`, `created_by_user_id`)
SELECT
	lower(hex(randomblob(16))),
	trim(ba.`label`),
	COALESCE(
		(SELECT `created_by_user_id` FROM `monthly_budgets` WHERE `id` = ba.`budget_id`),
		(SELECT `id` FROM `users` LIMIT 1)
	)
FROM `budget_allocations` ba
WHERE ba.`label` IS NOT NULL
	AND length(trim(ba.`label`)) > 0
	AND NOT EXISTS (
		SELECT 1 FROM `tags` t WHERE lower(t.`name`) = lower(trim(ba.`label`))
	)
GROUP BY lower(trim(ba.`label`));
--> statement-breakpoint
DROP TABLE IF EXISTS `budget_allocations_new`;
--> statement-breakpoint
CREATE TABLE `budget_allocations_new` (
	`id` text PRIMARY KEY NOT NULL,
	`budget_id` text NOT NULL,
	`parent_id` text,
	`category_id` text,
	`tag_id` text,
	`allocation_mode` text NOT NULL,
	`percent` real,
	`amount` real NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`budget_id`) REFERENCES `monthly_budgets`(`id`) ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`),
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`)
);
--> statement-breakpoint
INSERT INTO `budget_allocations_new` (
	`id`, `budget_id`, `parent_id`, `category_id`, `tag_id`, `allocation_mode`, `percent`, `amount`, `sort_order`
)
SELECT
	ba.`id`,
	ba.`budget_id`,
	ba.`parent_id`,
	ba.`category_id`,
	CASE
		WHEN ba.`parent_id` IS NOT NULL AND ba.`label` IS NOT NULL AND length(trim(ba.`label`)) > 0
			THEN (
				SELECT t.`id` FROM `tags` t
				WHERE lower(t.`name`) = lower(trim(ba.`label`))
				LIMIT 1
			)
		ELSE NULL
	END,
	ba.`allocation_mode`,
	ba.`percent`,
	ba.`amount`,
	ba.`sort_order`
FROM `budget_allocations` ba;
--> statement-breakpoint
DROP TABLE `budget_allocations`;
--> statement-breakpoint
ALTER TABLE `budget_allocations_new` RENAME TO `budget_allocations`;
--> statement-breakpoint
CREATE UNIQUE INDEX `budget_allocations_budget_category_uq`
ON `budget_allocations` (`budget_id`, `category_id`)
WHERE `category_id` IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `budget_allocations_budget_tag_uq`
ON `budget_allocations` (`budget_id`, `tag_id`)
WHERE `tag_id` IS NOT NULL;
