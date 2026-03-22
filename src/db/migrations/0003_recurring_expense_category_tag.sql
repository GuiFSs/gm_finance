ALTER TABLE `recurring_expenses` ADD `category_id` text REFERENCES categories(id);--> statement-breakpoint
ALTER TABLE `recurring_expenses` ADD `tag_id` text REFERENCES tags(id);