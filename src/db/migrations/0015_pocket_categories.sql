CREATE TABLE `pocket_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pocket_categories_name_unique` ON `pocket_categories` (`name`);
--> statement-breakpoint
ALTER TABLE `pockets` ADD `category_id` text REFERENCES `pocket_categories`(`id`) ON DELETE set null;
