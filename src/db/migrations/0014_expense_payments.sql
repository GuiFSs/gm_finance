ALTER TABLE `purchases` ADD `paid_at` text;
--> statement-breakpoint
CREATE TABLE `card_statement_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`statement_month` text NOT NULL,
	`paid_at` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `card_statement_payments_card_month_uq` ON `card_statement_payments` (`card_id`,`statement_month`);
