CREATE TABLE `monthly_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`month` text NOT NULL,
	`income_amount` real NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monthly_budgets_month_unique` ON `monthly_budgets` (`month`);
--> statement-breakpoint
CREATE TABLE `budget_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`budget_id` text NOT NULL,
	`parent_id` text,
	`category_id` text NOT NULL,
	`allocation_mode` text NOT NULL,
	`percent` real,
	`amount` real NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`budget_id`) REFERENCES `monthly_budgets`(`id`) ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `budget_allocations`(`id`) ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budget_allocations_budget_category_uq` ON `budget_allocations` (`budget_id`,`category_id`);
