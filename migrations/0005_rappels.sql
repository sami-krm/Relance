CREATE TABLE `preference` (
	`user_id` text PRIMARY KEY NOT NULL,
	`delai_relance` integer DEFAULT 7 NOT NULL,
	`delai_sans_reponse` integer DEFAULT 21 NOT NULL,
	`emails_rappel` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reminder` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`application_id` text,
	`type` text NOT NULL,
	`titre` text NOT NULL,
	`date` text NOT NULL,
	`statut` text DEFAULT 'a_faire' NOT NULL,
	`email_envoye` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`application_id`) REFERENCES `application`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reminder_user_id_idx` ON `reminder` (`user_id`);--> statement-breakpoint
CREATE INDEX `reminder_statut_date_idx` ON `reminder` (`statut`,`date`);