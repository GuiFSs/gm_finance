CREATE TABLE `deposit_splits` (
	`id` text PRIMARY KEY NOT NULL,
	`deposit_id` text NOT NULL,
	`target_type` text NOT NULL,
	`pocket_id` text,
	`amount` real NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`deposit_id`) REFERENCES `deposits`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pocket_id`) REFERENCES `pockets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recurring_deposit_splits` (
	`id` text PRIMARY KEY NOT NULL,
	`recurring_deposit_id` text NOT NULL,
	`target_type` text NOT NULL,
	`pocket_id` text,
	`percent` real NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`recurring_deposit_id`) REFERENCES `recurring_deposits`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pocket_id`) REFERENCES `pockets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
DROP INDEX "cards_name_unique";--> statement-breakpoint
DROP INDEX "categories_name_unique";--> statement-breakpoint
DROP INDEX "pockets_name_unique";--> statement-breakpoint
DROP INDEX "tags_name_unique";--> statement-breakpoint
DROP INDEX "users_name_unique";--> statement-breakpoint
ALTER TABLE `deposits` ALTER COLUMN "target_type" TO "target_type" text DEFAULT 'account';--> statement-breakpoint
CREATE UNIQUE INDEX `cards_name_unique` ON `cards` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `pockets_name_unique` ON `pockets` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_name_unique` ON `users` (`name`);--> statement-breakpoint
ALTER TABLE `recurring_deposits` ALTER COLUMN "target_type" TO "target_type" text;
--> statement-breakpoint
INSERT INTO `deposit_splits` (`id`, `deposit_id`, `target_type`, `pocket_id`, `amount`, `sort_order`)
SELECT lower(hex(randomblob(16))), `id`, coalesce(`target_type`, 'account'), `pocket_id`, `amount`, 0
FROM `deposits`;
--> statement-breakpoint
INSERT INTO `recurring_deposit_splits` (`id`, `recurring_deposit_id`, `target_type`, `pocket_id`, `percent`, `sort_order`)
SELECT lower(hex(randomblob(16))), `id`, coalesce(`target_type`, 'account'), `pocket_id`, 100, 0
FROM `recurring_deposits`;