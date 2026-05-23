CREATE TABLE `thread_files` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`thread_id` text,
	`thread_item_id` text,
	`xai_file_id` text NOT NULL,
	`filename` text NOT NULL,
	`media_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `thread_files_user_id_idx` ON `thread_files` (`user_id`);
--> statement-breakpoint
CREATE INDEX `thread_files_thread_id_idx` ON `thread_files` (`thread_id`);
--> statement-breakpoint
ALTER TABLE `thread_items` ADD `file_attachments` text;
