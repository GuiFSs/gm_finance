CREATE TABLE `recurring_expense_tags` (
	`recurring_expense_id` text NOT NULL,
	`tag_id` text NOT NULL,
	FOREIGN KEY (`recurring_expense_id`) REFERENCES `recurring_expenses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `recurring_expense_tags` (`recurring_expense_id`, `tag_id`)
SELECT `id`, `tag_id` FROM `recurring_expenses` WHERE `tag_id` IS NOT NULL;
--> statement-breakpoint
ALTER TABLE `recurring_expenses` DROP COLUMN `tag_id`;