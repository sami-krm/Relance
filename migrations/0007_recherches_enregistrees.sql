CREATE TABLE `saved_search` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`nom` text NOT NULL,
	`mots_cles` text DEFAULT '' NOT NULL,
	`ville` text DEFAULT '' NOT NULL,
	`distance` integer DEFAULT 30 NOT NULL,
	`debut` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `saved_search_user_id_idx` ON `saved_search` (`user_id`);