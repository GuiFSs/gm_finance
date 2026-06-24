ALTER TABLE `card_statement_funding_splits` ADD `purchase_id` text REFERENCES `purchases`(`id`) ON DELETE cascade;
