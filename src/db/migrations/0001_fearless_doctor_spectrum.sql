CREATE TABLE `recurring_deposits` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`amount` real NOT NULL,
	`recurrence_type` text DEFAULT 'monthly' NOT NULL,
	`next_execution_date` text NOT NULL,
	`target_type` text NOT NULL,
	`pocket_id` text,
	`created_by_user_id` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`pocket_id`) REFERENCES `pockets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `deposits` ADD `target_type` text DEFAULT 'account' NOT NULL;--> statement-breakpoint
ALTER TABLE `deposits` ADD `pocket_id` text REFERENCES pockets(id);--> statement-breakpoint
ALTER TABLE `deposits` ADD `recurring_deposit_id` text REFERENCES recurring_deposits(id);