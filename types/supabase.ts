export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          roles: string[] | null;
          /** NULL when roles is empty (pending first role choice). */
          active_role: "lister" | "cleaner" | null;
          abn: string | null;
          state: string | null;
          suburb: string;
          postcode: string | null;
          max_travel_km: number;
          full_name: string | null;
          /** Given name (e.g. Google OAuth). */
          first_name: string | null;
          /** Family name (e.g. Google OAuth). */
          last_name: string | null;
          /** OAuth provider avatar URL (e.g. Google `picture`). */
          avatar_url: string | null;
          phone: string | null;
          date_of_birth: string | null;
          years_experience: number | null;
          vehicle_type: string | null;
          profile_photo_url: string | null;
          bio: string | null;
          specialties: string[] | null;
          portfolio_photo_urls: string[] | null;
          business_name: string | null;
          insurance_policy_number: string | null;
          availability: Record<string, boolean> | null;
          equipment_notes: string | null;
          notification_preferences: Record<string, boolean> | null;
          email_force_disabled: boolean | null;
          email_preferences_locked: boolean | null;
          is_admin: boolean | null;
          /** Super-admin-only tools (e.g. Promo Tools). Requires is_admin. */
          is_super_admin: boolean;
          is_deleted: boolean | null;
          stripe_connect_id: string | null;
          stripe_onboarding_complete: boolean | null;
          stripe_payment_method_id: string | null;
          stripe_customer_id: string | null;
          expo_push_token: string | null;
          verification_badges: string[];
          is_email_verified: boolean;
          /** Product tour (React Joyride) dismissed or completed. */
          has_seen_onboarding_tour: boolean;
          created_at: string;
          updated_at: string;
          referred_by: string | null;
          referral_code: string | null;
          account_credit_cents: number;
          high_dispute_opens_30d: number;
          last_dispute_abuse_alert_at: string | null;
          preferred_payout_schedule: string;
          /** light | dark | system — UI theme preference */
          theme_preference: string | null;
          /** km | mi — display only; stored distances remain km */
          distance_unit: string | null;
          /** Unique marketplace handle for cleaners (lowercase); shown on bids when set. */
          cleaner_username: string | null;
          /** Denormalized from reviews where reviewee is this cleaner. */
          cleaner_avg_rating: number | null;
          cleaner_total_reviews: number | null;
          is_banned: boolean | null;
          banned_reason: string | null;
          /** Strikes from lister escrow cancel (non-responsive cleaner). */
          negative_stars: number;
          /** Temporary ban end time (cleaner marketplace). */
          ban_until: string | null;
          /** Completed jobs where this user was lister and 0% launch promo fee applied. */
          launch_promo_lister_jobs_used: number;
          /** Completed jobs where this user was winning cleaner when lister 0% promo applied. */
          launch_promo_cleaner_jobs_used: number;
          /** Sydney YYYY-MM for `free_tier_airbnb_recurring_jobs_used`; null/other month = counter not active. */
          free_tier_airbnb_recurring_month_key: string | null;
          /** Ongoing free-tier completions this month (Airbnb/recurring, not launch). */
          free_tier_airbnb_recurring_jobs_used: number;
        };
        Insert: {
          id: string;
          roles?: string[] | null;
          active_role?: "lister" | "cleaner" | null;
          abn?: string | null;
          state?: string | null;
          suburb?: string;
          postcode?: string | null;
          max_travel_km?: number;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          date_of_birth?: string | null;
          years_experience?: number | null;
          vehicle_type?: string | null;
          profile_photo_url?: string | null;
          bio?: string | null;
          specialties?: string[] | null;
          portfolio_photo_urls?: string[] | null;
          business_name?: string | null;
          insurance_policy_number?: string | null;
          availability?: Record<string, boolean> | null;
          equipment_notes?: string | null;
          notification_preferences?: Record<string, boolean> | null;
          email_force_disabled?: boolean | null;
          email_preferences_locked?: boolean | null;
          is_admin?: boolean | null;
          is_super_admin?: boolean;
          is_deleted?: boolean | null;
          stripe_connect_id?: string | null;
          stripe_onboarding_complete?: boolean | null;
          stripe_payment_method_id?: string | null;
          stripe_customer_id?: string | null;
          expo_push_token?: string | null;
          verification_badges?: string[];
          is_email_verified?: boolean;
          has_seen_onboarding_tour?: boolean;
          created_at?: string;
          updated_at?: string;
          referred_by?: string | null;
          referral_code?: string | null;
          account_credit_cents?: number;
          high_dispute_opens_30d?: number;
          last_dispute_abuse_alert_at?: string | null;
          preferred_payout_schedule?: string;
          theme_preference?: string | null;
          distance_unit?: string | null;
          cleaner_username?: string | null;
          cleaner_avg_rating?: number | null;
          cleaner_total_reviews?: number | null;
          is_banned?: boolean;
          banned_reason?: string | null;
          negative_stars?: number;
          ban_until?: string | null;
          launch_promo_lister_jobs_used?: number;
          launch_promo_cleaner_jobs_used?: number;
          free_tier_airbnb_recurring_month_key?: string | null;
          free_tier_airbnb_recurring_jobs_used?: number;
        };
        Update: {
          roles?: string[] | null;
          active_role?: "lister" | "cleaner" | null;
          abn?: string | null;
          state?: string | null;
          suburb?: string;
          postcode?: string | null;
          max_travel_km?: number;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          date_of_birth?: string | null;
          years_experience?: number | null;
          vehicle_type?: string | null;
          profile_photo_url?: string | null;
          bio?: string | null;
          specialties?: string[] | null;
          portfolio_photo_urls?: string[] | null;
          business_name?: string | null;
          insurance_policy_number?: string | null;
          availability?: Record<string, boolean> | null;
          equipment_notes?: string | null;
          notification_preferences?: Record<string, boolean> | null;
          email_force_disabled?: boolean | null;
          email_preferences_locked?: boolean | null;
          is_admin?: boolean | null;
          is_super_admin?: boolean;
          is_deleted?: boolean | null;
          stripe_connect_id?: string | null;
          stripe_onboarding_complete?: boolean | null;
          stripe_payment_method_id?: string | null;
          stripe_customer_id?: string | null;
          expo_push_token?: string | null;
          verification_badges?: string[];
          is_email_verified?: boolean;
          has_seen_onboarding_tour?: boolean;
          updated_at?: string;
          referred_by?: string | null;
          referral_code?: string | null;
          account_credit_cents?: number;
          high_dispute_opens_30d?: number;
          last_dispute_abuse_alert_at?: string | null;
          preferred_payout_schedule?: string;
          theme_preference?: string | null;
          distance_unit?: string | null;
          cleaner_username?: string | null;
          cleaner_avg_rating?: number | null;
          cleaner_total_reviews?: number | null;
          is_banned?: boolean;
          banned_reason?: string | null;
          negative_stars?: number;
          ban_until?: string | null;
          launch_promo_lister_jobs_used?: number;
          launch_promo_cleaner_jobs_used?: number;
          free_tier_airbnb_recurring_month_key?: string | null;
          free_tier_airbnb_recurring_jobs_used?: number;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      },
      listings: {
        Row: {
          id: string;
          lister_id: string;
          title: string;
          description: string | null;
          /** Lister narrative for cleaners (public); separate from special_instructions. */
          property_description: string | null;
          /** Full street address; shown to assigned cleaner / lister on job detail (optional). */
          property_address: string | null;
          suburb: string;
          /** Australian state/territory (e.g. QLD); optional on older rows. */
          state: string | null;
          postcode: string;
          property_type: string;
          bedrooms: number;
          bathrooms: number;
          addons: string[] | null;
          /** Keys from the Special areas step (balcony, garage, laundry, patio); subset of addons for UI. */
          special_areas: string[] | null;
          special_instructions: string | null;
          move_out_date: string | null;
          /** ISO date strings for lister-preferred cleaning window (optional). */
          preferred_dates: string[] | null;
          photo_urls: string[] | null;
          initial_photos: string[] | null;
          cover_photo_url: string | null;
          reserve_cents: number;
          buy_now_cents: number | null;
          starting_price_cents: number;
          current_lowest_bid_cents: number;
          duration_days: number;
          /** live | ended | expired (no bids at close) | … */
          status: string;
          end_time: string;
          created_at: string;
          /** Snapshot of admin platform % at listing creation; fees for this listing use this value. */
          platform_fee_percentage: number;
          /** Set when lister ends auction early (cancel listing); null for natural end. */
          cancelled_early_at: string | null;
          /** excellent_very_good | good | fair_average | poor_bad */
          property_condition: string | null;
          /** "1" | "2" */
          property_levels: string | null;
          /** bond_cleaning | recurring_house_cleaning | airbnb_turnover | deep_clean */
          service_type: string;
          /** weekly | fortnightly | monthly when recurring */
          recurring_frequency: string | null;
          airbnb_guest_capacity: number | null;
          airbnb_turnaround_hours: number | null;
          deep_clean_purpose: string | null;
          is_urgent: boolean;
          /** Service-specific extras (see lib/listing-service-details.ts). */
          service_details?: Json | null;
          recurring_series_start_date?: string | null;
          recurring_series_end_date?: string | null;
          recurring_series_max_occurrences?: number | null;
          recurring_next_occurrence_on?: string | null;
          recurring_contract_paused?: boolean;
        };
        Insert: {
          id?: string;
          lister_id: string;
          title: string;
          description?: string | null;
          property_description?: string | null;
          property_address?: string | null;
          suburb: string;
          state?: string | null;
          postcode: string;
          property_type: string;
          bedrooms: number;
          bathrooms: number;
          addons?: string[] | null;
          special_areas?: string[] | null;
          special_instructions?: string | null;
          move_out_date?: string | null;
          preferred_dates?: string[] | null;
          photo_urls?: string[] | null;
          initial_photos?: string[] | null;
          cover_photo_url?: string | null;
          reserve_cents: number;
          buy_now_cents?: number | null;
          starting_price_cents: number;
          current_lowest_bid_cents: number;
          duration_days: number;
          status?: string;
          end_time: string;
          created_at?: string;
          platform_fee_percentage?: number;
          cancelled_early_at?: string | null;
          property_condition?: string | null;
          property_levels?: string | null;
          service_type?: string;
          recurring_frequency?: string | null;
          airbnb_guest_capacity?: number | null;
          airbnb_turnaround_hours?: number | null;
          deep_clean_purpose?: string | null;
          is_urgent?: boolean;
          service_details?: Json;
          recurring_series_start_date?: string | null;
          recurring_series_end_date?: string | null;
          recurring_series_max_occurrences?: number | null;
          recurring_next_occurrence_on?: string | null;
          recurring_contract_paused?: boolean;
        };
        Update: {
          title?: string;
          description?: string | null;
          property_description?: string | null;
          property_address?: string | null;
          suburb?: string;
          state?: string | null;
          postcode?: string;
          property_type?: string;
          bedrooms?: number;
          bathrooms?: number;
          addons?: string[] | null;
          special_areas?: string[] | null;
          special_instructions?: string | null;
          move_out_date?: string | null;
          preferred_dates?: string[] | null;
          photo_urls?: string[] | null;
          initial_photos?: string[] | null;
          cover_photo_url?: string | null;
          reserve_cents?: number;
          buy_now_cents?: number | null;
          starting_price_cents?: number;
          current_lowest_bid_cents?: number;
          duration_days?: number;
          status?: string;
          end_time?: string;
          platform_fee_percentage?: number;
          cancelled_early_at?: string | null;
          property_condition?: string | null;
          property_levels?: string | null;
          service_type?: string;
          recurring_frequency?: string | null;
          airbnb_guest_capacity?: number | null;
          airbnb_turnaround_hours?: number | null;
          deep_clean_purpose?: string | null;
          is_urgent?: boolean;
          service_details?: Json;
          recurring_series_start_date?: string | null;
          recurring_series_end_date?: string | null;
          recurring_series_max_occurrences?: number | null;
          recurring_next_occurrence_on?: string | null;
          recurring_contract_paused?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "listings_lister_id_fkey";
            columns: ["lister_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      listing_comments: {
        Row: {
          id: string;
          listing_id: string;
          user_id: string;
          parent_comment_id: string | null;
          message_text: string;
          created_at: string;
          posted_as_role: string | null;
        };
        Insert: {
          id?: string;
          listing_id: string;
          user_id: string;
          parent_comment_id?: string | null;
          message_text: string;
          created_at?: string;
          posted_as_role?: string | null;
        };
        Update: {
          id?: string;
          listing_id?: string;
          user_id?: string;
          parent_comment_id?: string | null;
          message_text?: string;
          created_at?: string;
          posted_as_role?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "listing_comments_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_comments_parent_comment_id_fkey";
            columns: ["parent_comment_id"];
            isOneToOne: false;
            referencedRelation: "listing_comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_comments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      bids: {
        Row: {
          id: string;
          listing_id: string;
          cleaner_id: string;
          bidder_id: string;
          /** Legacy NOT NULL column in some DBs — whole AUD dollars; keep aligned with amount_cents. */
          amount: number;
          amount_cents: number;
          created_at: string;
          status:
            | "active"
            | "accepted"
            | "cancelled"
            | "pending_confirmation"
            | "declined_early";
          pending_confirmation_expires_at: string | null;
          early_action_token: string | null;
        };
        Insert: {
          id?: string;
          listing_id: string;
          cleaner_id: string;
          bidder_id: string;
          amount: number;
          amount_cents: number;
          created_at?: string;
          status?:
            | "active"
            | "accepted"
            | "cancelled"
            | "pending_confirmation"
            | "declined_early";
          pending_confirmation_expires_at?: string | null;
          early_action_token?: string | null;
        };
        Update: {
          listing_id?: string;
          cleaner_id?: string;
          bidder_id?: string;
          amount?: number;
          amount_cents?: number;
          created_at?: string;
          status?:
            | "active"
            | "accepted"
            | "cancelled"
            | "pending_confirmation"
            | "declined_early";
          pending_confirmation_expires_at?: string | null;
          early_action_token?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bids_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bids_cleaner_id_fkey";
            columns: ["cleaner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      jobs: {
        Row: {
          id: number;
          listing_id: string;
          lister_id: string;
          winner_id: string | null;
          status: string;
          title: string | null;
          agreed_amount_cents: number | null;
          secured_via_buy_now: boolean;
          payment_intent_id: string | null;
          /** First successful Pay & Start Job (escrow hold) timestamp. */
          escrow_funded_at: string | null;
          /** Lister cancelled after escrow (non-responsive cleaner flow). */
          lister_escrow_cancelled_at: string | null;
          lister_escrow_cancel_fee_cents: number | null;
          lister_escrow_cancel_refund_cents: number | null;
          lister_escrow_cancel_reason: string | null;
          /** Additional escrow holds (separate PaymentIntents); see `lib/job-top-up.ts`. */
          top_up_payments: Json;
          /** When status is accepted without escrow; lister must Pay & Start by this time (UTC). */
          lister_payment_due_at: string | null;
          payment_released_at: string | null;
          stripe_transfer_id: string | null;
          cleaner_confirmed_complete: boolean | null;
          cleaner_confirmed_at: string | null;
          auto_release_at: string | null;
          auto_release_at_original: string | null;
          review_extension_used_at: string | null;
          completed_at: string | null;
          disputed_at: string | null;
          dispute_reason: string | null;
          dispute_photos: string[] | null;
          dispute_evidence: string[] | null;
          dispute_status: string | null;
          dispute_opened_by: string | null;
          proposed_refund_amount: number | null;
          counter_proposal_amount: number | null;
          refund_amount: number | null;
          refund_status: string | null;
          dispute_cleaner_counter_used: boolean;
          dispute_lister_counter_used: boolean;
          admin_mediation_requested: boolean;
          admin_mediation_requested_at: string | null;
          dispute_resolution: string | null;
          resolution_type: string | null;
          resolution_at: string | null;
          resolution_by: string | null;
          created_at: string;
          updated_at: string;
          recurring_occurrence_id: string | null;
        };
        Insert: {
          id?: number;
          listing_id: string;
          lister_id: string;
          winner_id?: string | null;
          status?: string;
          title?: string | null;
          agreed_amount_cents?: number | null;
          secured_via_buy_now?: boolean;
          payment_intent_id?: string | null;
          escrow_funded_at?: string | null;
          lister_escrow_cancelled_at?: string | null;
          lister_escrow_cancel_fee_cents?: number | null;
          lister_escrow_cancel_refund_cents?: number | null;
          lister_escrow_cancel_reason?: string | null;
          top_up_payments?: Json;
          lister_payment_due_at?: string | null;
          payment_released_at?: string | null;
          stripe_transfer_id?: string | null;
          cleaner_confirmed_complete?: boolean | null;
          cleaner_confirmed_at?: string | null;
          auto_release_at?: string | null;
          auto_release_at_original?: string | null;
          review_extension_used_at?: string | null;
          completed_at?: string | null;
          disputed_at?: string | null;
          dispute_reason?: string | null;
          dispute_photos?: string[] | null;
          dispute_evidence?: string[] | null;
          dispute_status?: string | null;
          dispute_opened_by?: string | null;
          proposed_refund_amount?: number | null;
          counter_proposal_amount?: number | null;
          refund_amount?: number | null;
          refund_status?: string | null;
          dispute_cleaner_counter_used?: boolean;
          dispute_lister_counter_used?: boolean;
          admin_mediation_requested?: boolean;
          admin_mediation_requested_at?: string | null;
          dispute_resolution?: string | null;
          resolution_type?: string | null;
          resolution_at?: string | null;
          resolution_by?: string | null;
          created_at?: string;
          updated_at?: string;
          recurring_occurrence_id?: string | null;
        };
        Update: {
          listing_id?: string;
          lister_id?: string;
          winner_id?: string | null;
          status?: string;
          title?: string | null;
          agreed_amount_cents?: number | null;
          secured_via_buy_now?: boolean;
          payment_intent_id?: string | null;
          escrow_funded_at?: string | null;
          lister_escrow_cancelled_at?: string | null;
          lister_escrow_cancel_fee_cents?: number | null;
          lister_escrow_cancel_refund_cents?: number | null;
          lister_escrow_cancel_reason?: string | null;
          top_up_payments?: Json;
          lister_payment_due_at?: string | null;
          payment_released_at?: string | null;
          stripe_transfer_id?: string | null;
          cleaner_confirmed_complete?: boolean | null;
          cleaner_confirmed_at?: string | null;
          auto_release_at?: string | null;
          auto_release_at_original?: string | null;
          review_extension_used_at?: string | null;
          completed_at?: string | null;
          disputed_at?: string | null;
          dispute_reason?: string | null;
          dispute_photos?: string[] | null;
          dispute_evidence?: string[] | null;
          dispute_status?: string | null;
          dispute_opened_by?: string | null;
          proposed_refund_amount?: number | null;
          counter_proposal_amount?: number | null;
          refund_amount?: number | null;
          refund_status?: string | null;
          dispute_cleaner_counter_used?: boolean;
          dispute_lister_counter_used?: boolean;
          admin_mediation_requested?: boolean;
          admin_mediation_requested_at?: string | null;
          dispute_resolution?: string | null;
          resolution_type?: string | null;
          resolution_at?: string | null;
          resolution_by?: string | null;
          updated_at?: string;
          recurring_occurrence_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_lister_id_fkey";
            columns: ["lister_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_winner_id_fkey";
            columns: ["winner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      recurring_contracts: {
        Row: {
          id: string;
          listing_id: string;
          lister_id: string;
          cleaner_id: string | null;
          frequency: string;
          agreed_amount_cents: number;
          platform_fee_percentage: number;
          series_start_date: string;
          series_end_date: string | null;
          max_occurrences: number | null;
          visits_completed: number;
          paused_at: string | null;
          resume_scheduled_for: string | null;
          next_occurrence_on: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          lister_id: string;
          cleaner_id?: string | null;
          frequency: string;
          agreed_amount_cents: number;
          platform_fee_percentage?: number;
          series_start_date: string;
          series_end_date?: string | null;
          max_occurrences?: number | null;
          visits_completed?: number;
          paused_at?: string | null;
          resume_scheduled_for?: string | null;
          next_occurrence_on?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          cleaner_id?: string | null;
          frequency?: string;
          agreed_amount_cents?: number;
          platform_fee_percentage?: number;
          series_start_date?: string;
          series_end_date?: string | null;
          max_occurrences?: number | null;
          visits_completed?: number;
          paused_at?: string | null;
          resume_scheduled_for?: string | null;
          next_occurrence_on?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      recurring_occurrences: {
        Row: {
          id: string;
          contract_id: string;
          scheduled_date: string;
          status: string;
          job_id: number | null;
          skip_reason_key: string | null;
          skip_reason_detail: string | null;
          one_off_pattern_resume_from: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contract_id: string;
          scheduled_date: string;
          status: string;
          job_id?: number | null;
          skip_reason_key?: string | null;
          skip_reason_detail?: string | null;
          one_off_pattern_resume_from?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          scheduled_date?: string;
          status?: string;
          job_id?: number | null;
          skip_reason_key?: string | null;
          skip_reason_detail?: string | null;
          one_off_pattern_resume_from?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      job_lister_cancellation_audit: {
        Row: {
          id: string;
          job_id: number;
          lister_id: string;
          cleaner_id: string | null;
          charge_total_cents: number;
          platform_fee_cents: number;
          cancellation_fee_cents: number;
          refund_cents: number;
          platform_fee_percent_snapshot: number | null;
          reason: string | null;
          cleaner_negative_stars_after: number | null;
          cleaner_banned: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: number;
          lister_id: string;
          cleaner_id?: string | null;
          charge_total_cents: number;
          platform_fee_cents: number;
          cancellation_fee_cents: number;
          refund_cents: number;
          platform_fee_percent_snapshot?: number | null;
          reason?: string | null;
          cleaner_negative_stars_after?: number | null;
          cleaner_banned?: boolean;
          created_at?: string;
        };
        Update: {
          job_id?: number;
          lister_id?: string;
          cleaner_id?: string | null;
          charge_total_cents?: number;
          platform_fee_cents?: number;
          cancellation_fee_cents?: number;
          refund_cents?: number;
          platform_fee_percent_snapshot?: number | null;
          reason?: string | null;
          cleaner_negative_stars_after?: number | null;
          cleaner_banned?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_lister_cancellation_audit_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          }
        ];
      };
      job_checklist_items: {
        Row: {
          id: number;
          job_id: number;
          label: string;
          is_completed: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          job_id: number;
          label: string;
          is_completed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          job_id?: number;
          label?: string;
          is_completed?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_checklist_items_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          }
        ];
      };
      job_messages: {
        Row: {
          id: number;
          job_id: number;
          sender_id: string;
          message_text: string;
          created_at: string;
          image_url: string | null;
          read_at: string | null;
        };
        Insert: {
          id?: number;
          job_id: number;
          sender_id: string;
          message_text: string;
          created_at?: string;
          image_url?: string | null;
          read_at?: string | null;
        };
        Update: {
          id?: number;
          job_id?: number;
          sender_id?: string;
          message_text?: string;
          created_at?: string;
          image_url?: string | null;
          read_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "job_messages_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          }
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type:
            | "job_accepted"
            | "new_message"
            | "job_completed"
            | "payment_released"
            | "funds_ready"
            | "dispute_opened"
            | "dispute_resolved"
            | "job_created"
            | "job_approved_to_start"
            | "new_bid"
            | "job_cancelled_by_lister"
            | "listing_cancelled_by_lister"
            | "referral_reward"
            | "listing_live"
            | "after_photos_uploaded"
            | "auto_release_warning"
            | "checklist_all_complete"
            | "new_job_in_area"
            | "job_status_update"
            | "early_accept_declined"
            | "listing_public_comment"
            | "daily_digest"
            | "job_won_complete_payout"
            | "lister_payout_blocked_cleaner_stripe"
            | "bid_outbid"
            | "listing_assigned_buy_now"
            | "listing_expired_no_bids"
            | "launch_promo_active"
            | "launch_promo_progress"
            | "launch_promo_ended";
          job_id: number | null;
          message_text: string;
          /** Short label for lists (e.g. New bid · Job #12). */
          title: string | null;
          /** Body text; mirrors message_text when set. */
          body: string | null;
          /** Structured payload (job_id, listing_id, etc.). */
          data: Record<string, unknown> | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type:
            | "job_accepted"
            | "new_message"
            | "job_completed"
            | "payment_released"
            | "funds_ready"
            | "dispute_opened"
            | "dispute_resolved"
            | "job_created"
            | "job_approved_to_start"
            | "new_bid"
            | "job_cancelled_by_lister"
            | "listing_cancelled_by_lister"
            | "referral_reward"
            | "listing_live"
            | "after_photos_uploaded"
            | "auto_release_warning"
            | "checklist_all_complete"
            | "new_job_in_area"
            | "job_status_update"
            | "early_accept_declined"
            | "listing_public_comment"
            | "job_won_complete_payout"
            | "lister_payout_blocked_cleaner_stripe"
            | "bid_outbid"
            | "listing_assigned_buy_now"
            | "listing_expired_no_bids"
            | "launch_promo_active"
            | "launch_promo_progress"
            | "launch_promo_ended";
          job_id?: number | null;
          message_text: string;
          title?: string | null;
          body?: string | null;
          data?: Record<string, unknown>;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?:
            | "job_accepted"
            | "new_message"
            | "job_completed"
            | "payment_released"
            | "funds_ready"
            | "dispute_opened"
            | "dispute_resolved"
            | "job_created"
            | "job_approved_to_start"
            | "new_bid"
            | "job_cancelled_by_lister"
            | "listing_cancelled_by_lister"
            | "referral_reward"
            | "listing_live"
            | "after_photos_uploaded"
            | "auto_release_warning"
            | "checklist_all_complete"
            | "new_job_in_area"
            | "job_status_update"
            | "early_accept_declined"
            | "listing_public_comment"
            | "job_won_complete_payout"
            | "lister_payout_blocked_cleaner_stripe"
            | "bid_outbid"
            | "listing_assigned_buy_now"
            | "listing_expired_no_bids"
            | "launch_promo_active"
            | "launch_promo_progress"
            | "launch_promo_ended";
          job_id?: number | null;
          message_text?: string;
          title?: string | null;
          body?: string | null;
          data?: Record<string, unknown>;
          is_read?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          }
        ];
      };
      referral_rewards: {
        Row: {
          id: string;
          job_id: number;
          referred_user_id: string;
          referrer_id: string;
          referred_credit_cents: number;
          referrer_credit_cents: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: number;
          referred_user_id: string;
          referrer_id: string;
          referred_credit_cents: number;
          referrer_credit_cents: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: number;
          referred_user_id?: string;
          referrer_id?: string;
          referred_credit_cents?: number;
          referrer_credit_cents?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "referral_rewards_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: true;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          }
        ];
      };
      reviews: {
        Row: {
          id: number;
          job_id: number;
          reviewer_id: string;
          reviewee_id: string;
          reviewee_role: string | null;
          reviewee_type: string | null;
          overall_rating: number;
          quality_of_work: number | null;
          reliability: number | null;
          communication: number | null;
          punctuality: number | null;
          review_text: string | null;
          review_photos: string[] | null;
          created_at: string;
          is_approved: boolean;
          is_hidden: boolean;
          is_flagged: boolean;
          moderation_note: string | null;
          moderated_at: string | null;
          moderated_by: string | null;
        };
        Insert: {
          id?: number;
          job_id: number;
          reviewer_id: string;
          reviewee_id: string;
          reviewee_role?: string | null;
          reviewee_type?: string | null;
          overall_rating: number;
          quality_of_work?: number | null;
          reliability?: number | null;
          communication?: number | null;
          punctuality?: number | null;
          review_text?: string | null;
          review_photos?: string[] | null;
          created_at?: string;
          is_approved?: boolean;
          is_hidden?: boolean;
          is_flagged?: boolean;
          moderation_note?: string | null;
          moderated_at?: string | null;
          moderated_by?: string | null;
        };
        Update: {
          job_id?: number;
          reviewer_id?: string;
          reviewee_id?: string;
          reviewee_role?: string | null;
          reviewee_type?: string | null;
          overall_rating?: number;
          quality_of_work?: number | null;
          reliability?: number | null;
          communication?: number | null;
          punctuality?: number | null;
          review_text?: string | null;
          review_photos?: string[] | null;
          created_at?: string;
          is_approved?: boolean;
          is_hidden?: boolean;
          is_flagged?: boolean;
          moderation_note?: string | null;
          moderated_at?: string | null;
          moderated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          }
        ];
      };
      email_logs: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          sent_at: string;
          subject: string | null;
          status?: string | null;
          error_message?: string | null;
          recipient_email?: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          sent_at?: string;
          subject?: string | null;
          status?: string | null;
          error_message?: string | null;
          recipient_email?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          sent_at?: string;
          subject?: string | null;
          status?: string | null;
          error_message?: string | null;
          recipient_email?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "email_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      email_template_overrides: {
        Row: {
          template_key: string;
          subject: string;
          body: string;
          active: boolean;
          type_enabled: boolean;
          send_after: string;
          updated_at: string;
        };
        Insert: {
          template_key: string;
          subject?: string;
          body?: string;
          active?: boolean;
          type_enabled?: boolean;
          send_after?: string;
          updated_at?: string;
        };
        Update: {
          template_key?: string;
          subject?: string;
          body?: string;
          active?: boolean;
          type_enabled?: boolean;
          send_after?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      help_articles: {
        Row: {
          id: string;
          title: string;
          slug: string;
          category: string;
          content: string;
          is_published: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
          /** Optional: set when using pgvector for semantic search (match_help_articles RPC). */
          embedding?: number[] | null;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          category: string;
          content: string;
          is_published?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          embedding?: number[] | null;
        };
        Update: {
          title?: string;
          slug?: string;
          category?: string;
          content?: string;
          is_published?: boolean;
          sort_order?: number;
          updated_at?: string;
          embedding?: number[] | null;
        };
        Relationships: [];
      };
      support_tickets: {
        Row: {
          id: string;
          user_id: string;
          subject: string;
          description: string;
          category: string;
          priority: string;
          suggested_category: string | null;
          confidence: number | null;
          ai_reason: string | null;
          status: string;
          email: string | null;
          job_id: number | null;
          listing_id: string | null;
          attachment_urls: string[] | null;
          last_activity_at: string;
          auto_close_after: string | null;
          auto_close_warned_at: string | null;
          closed_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject: string;
          description: string;
          category?: string;
          priority?: string;
          suggested_category?: string | null;
          confidence?: number | null;
          ai_reason?: string | null;
          status?: string;
          email?: string | null;
          job_id?: number | null;
          listing_id?: string | null;
          attachment_urls?: string[] | null;
          last_activity_at?: string;
          auto_close_after?: string | null;
          auto_close_warned_at?: string | null;
          closed_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          subject?: string;
          description?: string;
          category?: string;
          priority?: string;
          suggested_category?: string | null;
          confidence?: number | null;
          ai_reason?: string | null;
          status?: string;
          email?: string | null;
          job_id?: number | null;
          listing_id?: string | null;
          attachment_urls?: string[] | null;
          last_activity_at?: string;
          auto_close_after?: string | null;
          auto_close_warned_at?: string | null;
          closed_reason?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "support_tickets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      support_ticket_messages: {
        Row: {
          id: string;
          ticket_id: string;
          author_user_id: string | null;
          author_role: string;
          body: string;
          attachment_urls: string[] | null;
          email_from: string | null;
          email_to: string[] | null;
          external_message_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          author_user_id?: string | null;
          author_role?: string;
          body: string;
          attachment_urls?: string[] | null;
          email_from?: string | null;
          email_to?: string[] | null;
          external_message_id?: string | null;
          created_at?: string;
        };
        Update: {
          author_user_id?: string | null;
          author_role?: string;
          body?: string;
          attachment_urls?: string[] | null;
          email_from?: string | null;
          email_to?: string[] | null;
          external_message_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "support_tickets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_ticket_messages_author_user_id_fkey";
            columns: ["author_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      system_error_log: {
        Row: {
          id: string;
          created_at: string;
          source: string;
          severity: string;
          route_path: string | null;
          job_id: number | null;
          listing_id: string | null;
          message: string;
          code: string | null;
          details: string | null;
          hint: string | null;
          context: Json;
          user_id: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          source: string;
          severity?: string;
          route_path?: string | null;
          job_id?: number | null;
          listing_id?: string | null;
          message: string;
          code?: string | null;
          details?: string | null;
          hint?: string | null;
          context?: Json;
          user_id?: string | null;
        };
        Update: {
          source?: string;
          severity?: string;
          route_path?: string | null;
          job_id?: number | null;
          listing_id?: string | null;
          message?: string;
          code?: string | null;
          details?: string | null;
          hint?: string | null;
          context?: Json;
          user_id?: string | null;
        };
        Relationships: [];
      };
      seo_regions: {
        Row: {
          id: string;
          name: string;
          slug: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      seo_suburbs: {
        Row: {
          id: string;
          region_id: string;
          suburb_name: string;
          postcode: string;
          slug: string;
          priority: number;
          completed: boolean;
          completed_at: string | null;
          last_checked: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          region_id: string;
          suburb_name: string;
          postcode: string;
          slug: string;
          priority?: number;
          completed?: boolean;
          completed_at?: string | null;
          last_checked?: string | null;
          notes?: string | null;
        };
        Update: {
          region_id?: string;
          suburb_name?: string;
          postcode?: string;
          slug?: string;
          priority?: number;
          completed?: boolean;
          completed_at?: string | null;
          last_checked?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "seo_suburbs_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "seo_regions";
            referencedColumns: ["id"];
          }
        ];
      };
      seo_content: {
        Row: {
          id: string;
          suburb_id: string;
          region_id: string;
          page_slug: string;
          landing: Json;
          blog_posts: Json;
          faq_schema: Json;
          meta_title: string | null;
          meta_description: string | null;
          last_error: string | null;
          last_checked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          suburb_id: string;
          region_id: string;
          page_slug: string;
          landing?: Json;
          blog_posts?: Json;
          faq_schema?: Json;
          meta_title?: string | null;
          meta_description?: string | null;
          last_error?: string | null;
          last_checked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          suburb_id?: string;
          region_id?: string;
          page_slug?: string;
          landing?: Json;
          blog_posts?: Json;
          faq_schema?: Json;
          meta_title?: string | null;
          meta_description?: string | null;
          last_error?: string | null;
          last_checked_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seo_content_suburb_id_fkey";
            columns: ["suburb_id"];
            isOneToOne: true;
            referencedRelation: "seo_suburbs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seo_content_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "seo_regions";
            referencedColumns: ["id"];
          }
        ];
      };
      seo_manual_task_state: {
        Row: {
          user_id: string;
          region_slug: string;
          task_key: string;
          completed_at: string;
        };
        Insert: {
          user_id: string;
          region_slug: string;
          task_key: string;
          completed_at?: string;
        };
        Update: {
          completed_at?: string;
        };
        Relationships: [];
      };
      seo_manual_checklist: {
        Row: {
          task_key: string;
          completed_at: string | null;
          notes: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          task_key: string;
          completed_at?: string | null;
          notes?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          completed_at?: string | null;
          notes?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      apply_listing_auction_outcomes: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      listing_ids_with_jobs: {
        Args: Record<string, never>;
        Returns: { listing_id: string }[];
      };
      count_unread_notifications_for_role: {
        Args: {
          p_user_id: string;
          p_active_role: string | null;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

