CREATE TYPE "public"."user_role" AS ENUM('admin', 'reader');--> statement-breakpoint
CREATE TYPE "public"."blacklist_scope" AS ENUM('nace_code', 'sector', 'keyword', 'municipality', 'company', 'email', 'domain', 'contact');--> statement-breakpoint
CREATE TYPE "public"."data_import_status" AS ENUM('pending', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."prospect_status" AS ENUM('nouveau', 'a_contacter', 'contacte', 'ouvert', 'clique', 'interesse', 'reponse_recue', 'a_rappeler', 'devis_demande', 'client', 'pas_interesse', 'ne_plus_contacter');--> statement-breakpoint
CREATE TYPE "public"."score_tier" AS ENUM('tres_haute', 'haute', 'moyenne', 'faible', 'ignorer');--> statement-breakpoint
CREATE TYPE "public"."campaign_mode" AS ENUM('dry_run', 'production');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'scheduled', 'running', 'paused', 'completed');--> statement-breakpoint
CREATE TYPE "public"."email_event_type" AS ENUM('delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed');--> statement-breakpoint
CREATE TYPE "public"."email_send_status" AS ENUM('scheduled', 'sent', 'bounced', 'failed', 'skipped_suppressed', 'skipped_no_email');--> statement-breakpoint
CREATE TYPE "public"."automation_run_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "login_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"ip_address" text NOT NULL,
	"success" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'reader' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "geographic_zones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"postal_code" text NOT NULL,
	"municipality" text NOT NULL,
	"province" text NOT NULL,
	"region" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "geographic_zones_postal_code_unique" UNIQUE("postal_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nace_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"label_fr" text NOT NULL,
	"label_nl" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sector_nace_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sector_id" uuid NOT NULL,
	"nace_prefix" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sector_nace_rules_sector_prefix_unique" UNIQUE("sector_id","nace_prefix")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sectors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sectors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blacklists" (
	"id" uuid PRIMARY KEY NOT NULL,
	"scope" "blacklist_scope" NOT NULL,
	"value" text NOT NULL,
	"reason" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_imports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"data_source_id" uuid NOT NULL,
	"status" "data_import_status" DEFAULT 'pending' NOT NULL,
	"file_name" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"records_seen" integer DEFAULT 0 NOT NULL,
	"records_created" integer DEFAULT 0 NOT NULL,
	"records_updated" integer DEFAULT 0 NOT NULL,
	"records_skipped" integer DEFAULT 0 NOT NULL,
	"duplicates_found" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_sources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"adapter_type" text NOT NULL,
	"is_enabled" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_sources_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "companies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"enterprise_number" text,
	"name" text NOT NULL,
	"legal_form" text,
	"start_date" date,
	"street" text,
	"house_number" text,
	"postal_code" text,
	"municipality" text,
	"province" text,
	"region" text,
	"primary_nace_code" text,
	"sector_id" uuid,
	"description" text,
	"email" text,
	"phone" text,
	"website" text,
	"has_website" text,
	"data_source_id" uuid,
	"source_record_id" text,
	"confidence" text DEFAULT 'medium' NOT NULL,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"merged_into_company_id" uuid,
	CONSTRAINT "companies_enterprise_number_unique" UNIQUE("enterprise_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contacts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"first_name" text,
	"last_name" text,
	"role" text,
	"email" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contacts_company_email_unique" UNIQUE("company_id","email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prospect_tags" (
	"prospect_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "prospect_tags_prospect_id_tag_id_pk" PRIMARY KEY("prospect_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prospects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"status" "prospect_status" DEFAULT 'nouveau' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"score_tier" "score_tier" DEFAULT 'ignorer' NOT NULL,
	"score_breakdown" text,
	"is_eligible_for_email" text DEFAULT 'false' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prospects_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scoring_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"points" integer NOT NULL,
	"condition" text NOT NULL,
	"is_active" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scoring_rules_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tags" (
	"id" uuid PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_label_unique" UNIQUE("label")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campaign_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"step_order" integer NOT NULL,
	"delay_days" integer DEFAULT 0 NOT NULL,
	"email_template_id" uuid,
	"stop_on_reply" text DEFAULT 'true' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campaigns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"offer_id" uuid,
	"mode" "campaign_mode" DEFAULT 'dry_run' NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"segment_filter" text,
	"daily_send_limit" integer DEFAULT 50 NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "offers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sector_id" uuid,
	"pitch" text,
	"advantage" text,
	"cta_label" text,
	"landing_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email_send_id" uuid NOT NULL,
	"type" "email_event_type" NOT NULL,
	"metadata" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_replies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email_send_id" uuid,
	"prospect_id" uuid NOT NULL,
	"from_email" text NOT NULL,
	"subject" text,
	"body_text" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_sends" (
	"id" uuid PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"campaign_step_id" uuid,
	"prospect_id" uuid NOT NULL,
	"email_template_id" uuid,
	"to_email" text NOT NULL,
	"status" "email_send_status" DEFAULT 'scheduled' NOT NULL,
	"provider_message_id" text,
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "suppression_list" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppression_list_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "automation_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"automation_id" uuid NOT NULL,
	"lock_key" text NOT NULL,
	"status" "automation_run_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"attempt" text DEFAULT '1' NOT NULL,
	"result" jsonb,
	"error_message" text,
	CONSTRAINT "automation_runs_lock_key_unique" UNIQUE("lock_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "automations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"cron_schedule" text,
	"is_enabled" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sector_nace_rules" ADD CONSTRAINT "sector_nace_rules_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data_imports" ADD CONSTRAINT "data_imports_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "companies" ADD CONSTRAINT "companies_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "companies" ADD CONSTRAINT "companies_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prospect_tags" ADD CONSTRAINT "prospect_tags_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prospect_tags" ADD CONSTRAINT "prospect_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prospects" ADD CONSTRAINT "prospects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaign_steps" ADD CONSTRAINT "campaign_steps_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "offers" ADD CONSTRAINT "offers_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_events" ADD CONSTRAINT "email_events_email_send_id_email_sends_id_fk" FOREIGN KEY ("email_send_id") REFERENCES "public"."email_sends"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_replies" ADD CONSTRAINT "email_replies_email_send_id_email_sends_id_fk" FOREIGN KEY ("email_send_id") REFERENCES "public"."email_sends"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_replies" ADD CONSTRAINT "email_replies_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_campaign_step_id_campaign_steps_id_fk" FOREIGN KEY ("campaign_step_id") REFERENCES "public"."campaign_steps"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_email_template_id_email_templates_id_fk" FOREIGN KEY ("email_template_id") REFERENCES "public"."email_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "login_attempts_email_idx" ON "login_attempts" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "login_attempts_ip_created_idx" ON "login_attempts" USING btree ("ip_address","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "geographic_zones_province_idx" ON "geographic_zones" USING btree ("province");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "geographic_zones_region_idx" ON "geographic_zones" USING btree ("region");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "geographic_zones_active_idx" ON "geographic_zones" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sector_nace_rules_prefix_idx" ON "sector_nace_rules" USING btree ("nace_prefix");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blacklists_scope_value_idx" ON "blacklists" USING btree ("scope","value");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "data_imports_source_idx" ON "data_imports" USING btree ("data_source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "data_imports_status_idx" ON "data_imports" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "data_imports_created_at_idx" ON "data_imports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "companies_postal_code_idx" ON "companies" USING btree ("postal_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "companies_province_idx" ON "companies" USING btree ("province");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "companies_nace_idx" ON "companies" USING btree ("primary_nace_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "companies_sector_idx" ON "companies" USING btree ("sector_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "companies_collected_at_idx" ON "companies" USING btree ("collected_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "companies_email_idx" ON "companies" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "companies_website_idx" ON "companies" USING btree ("website");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_company_id_idx" ON "contacts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_email_idx" ON "contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prospects_status_idx" ON "prospects" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prospects_score_idx" ON "prospects" USING btree ("score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prospects_score_tier_idx" ON "prospects" USING btree ("score_tier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_steps_campaign_idx" ON "campaign_steps" USING btree ("campaign_id","step_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaigns_status_idx" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_events_send_idx" ON "email_events" USING btree ("email_send_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_events_type_idx" ON "email_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_replies_prospect_idx" ON "email_replies" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_sends_campaign_idx" ON "email_sends" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_sends_prospect_idx" ON "email_sends" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_sends_status_idx" ON "email_sends" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_sends_provider_message_id_idx" ON "email_sends" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suppression_list_email_idx" ON "suppression_list" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "automation_runs_automation_idx" ON "automation_runs" USING btree ("automation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "automation_runs_status_idx" ON "automation_runs" USING btree ("status");