CREATE TABLE `contact` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`company_id` text NOT NULL,
	`nom` text NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`telephone` text DEFAULT '' NOT NULL,
	`linkedin` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contact_user_id_idx` ON `contact` (`user_id`);--> statement-breakpoint
CREATE INDEX `contact_company_id_idx` ON `contact` (`company_id`);--> statement-breakpoint
CREATE TABLE `company` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`nom` text NOT NULL,
	`ville` text DEFAULT '' NOT NULL,
	`site` text DEFAULT '' NOT NULL,
	`secteur` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `company_user_id_idx` ON `company` (`user_id`);--> statement-breakpoint
CREATE TABLE `offer` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`company_id` text NOT NULL,
	`intitule` text NOT NULL,
	`lieu` text DEFAULT '' NOT NULL,
	`contrat` text DEFAULT '' NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`lien` text DEFAULT '' NOT NULL,
	`date_publication` text DEFAULT '' NOT NULL,
	`date_limite` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`expiree` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `offer_user_id_idx` ON `offer` (`user_id`);--> statement-breakpoint
CREATE INDEX `offer_company_id_idx` ON `offer` (`company_id`);