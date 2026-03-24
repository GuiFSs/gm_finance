CREATE TABLE `card_statement_funding_splits` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`statement_month` text NOT NULL,
	`target_type` text NOT NULL,
	`pocket_id` text,
	`percent` real NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pocket_id`) REFERENCES `pockets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
