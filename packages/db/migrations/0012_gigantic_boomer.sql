CREATE TYPE "public"."cultural_events_attendance" AS ENUM('ALWAYS', 'IMPORTANT_ONLY', 'OCCASIONALLY', 'RARELY');--> statement-breakpoint
CREATE TYPE "public"."family_decision_involvement" AS ENUM('HIGH_COLLABORATIVE', 'CONSULTATIVE', 'INFORMED_ONLY', 'INDEPENDENT');--> statement-breakpoint
CREATE TYPE "public"."parents_living_situation" AS ENUM('YES_COMMITTED', 'OPEN', 'NO_OBJECTION', 'PREFER_SEPARATE');--> statement-breakpoint
CREATE TYPE "public"."religious_observance_with_family" AS ENUM('VERY_ACTIVE_TOGETHER', 'ACTIVE_INDIVIDUALLY', 'OCCASIONAL', 'PERSONAL_ONLY', 'NOT_PRACTICING');