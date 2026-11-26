CREATE TABLE `application` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`company_id` text NOT NULL,
	`offer_id` text,
	`contact_id` text,
	`cv_id` text,
	`poste` text NOT NULL,
	`canal` text DEFAULT '' NOT NULL,
	`statut` text DEFAULT 'brouillon' NOT NULL,
	`date_envoi` text DEFAULT '' NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`lien` text DEFAULT '' NOT NULL,
	`lettre` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`etiquettes` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`offer_id`) REFERENCES `offer`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`contact_id`) REFERENCES `contact`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`cv_id`) REFERENCES `document`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `application_user_id_idx` ON `application` (`user_id`);--> statement-breakpoint
CREATE INDEX `application_company_id_idx` ON `application` (`company_id`);--> statement-breakpoint
CREATE TABLE `application_event` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`type` text NOT NULL,
	`statut` text,
	`texte` text DEFAULT '' NOT NULL,
	`date` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `application`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `application_event_application_id_idx` ON `application_event` (`application_id`);--> statement-breakpoint
ALTER TABLE `document` ADD `archived_at` integer;