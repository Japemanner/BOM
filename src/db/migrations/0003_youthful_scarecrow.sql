CREATE TABLE "assistant_events" (
	"id" text PRIMARY KEY NOT NULL,
	"assistant_id" text NOT NULL,
	"assistant_name" text NOT NULL,
	"event_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
