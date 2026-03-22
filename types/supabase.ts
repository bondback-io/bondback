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
          active_role: "lister" | "cleaner";
          abn: string | null;
          state: string | null;
          suburb: string;
          postcode: string | null;
          max_travel_km: number;
          full_name: string | null;
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
          is_deleted: boolean | null;
          stripe_connect_id: string | null;
          stripe_payment_method_id: string | null;
          stripe_customer_id: string | null;
          expo_push_token: string | null;
          verification_badges: string[];
          is_email_verified: boolean;
          created_at: string;
          updated_at: string;
          referred_by: string | null;
          referral_code: string | null;
          account_credit_cents: number;
          high_dispute_opens_30d: number;
          last_dispute_abuse_alert_at: string | null;
          preferred_payout_schedule: string;
        };
        Insert: {
          id: string;
          roles?: string[] | null;
          active_role?: "lister" | "cleaner";
          abn?: string | null;
          state?: string | null;
          suburb?: string;
          postcode?: string | null;
          max_travel_km?: number;
          full_name?: string | null;
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
          is_deleted?: boolean | null;
          stripe_connect_id?: string | null;
          stripe_payment_method_id?: string | null;
          stripe_customer_id?: string | null;
          expo_push_token?: string | null;
          verification_badges?: string[];
          is_email_verified?: boolean;
          created_at?: string;
          updated_at?: string;
          referred_by?: string | null;
          referral_code?: string | null;
          account_credit_cents?: number;
          high_dispute_opens_30d?: number;
          last_dispute_abuse_alert_at?: string | null;
          preferred_payout_schedule?: string;
        };
        Update: {
          roles?: string[] | null;
          active_role?: "lister" | "cleaner";
          abn?: string | null;
          state?: string | null;
          suburb?: string;
          postcode?: string | null;
          max_travel_km?: number;
          full_name?: string | null;
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
          is_deleted?: boolean | null;
          stripe_connect_id?: string | null;
          stripe_payment_method_id?: string | null;
          stripe_customer_id?: string | null;
          expo_push_token?: string | null;
          verification_badges?: string[];
          is_email_verified?: boolean;
          updated_at?: string;
          referred_by?: string | null;
          referral_code?: string | null;
          account_credit_cents?: number;
          high_dispute_opens_30d?: number;
          last_dispute_abuse_alert_at?: string | null;
          preferred_payout_schedule?: string;
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
          suburb: string;
          postcode: string;
          property_type: string;
          bedrooms: number;
          bathrooms: number;
          addons: string[] | null;
          special_instructions: string | null;
          move_out_date: string | null;
          photo_urls: string[] | null;
          initial_photos: string[] | null;
          cover_photo_url: string | null;
          reserve_cents: number;
          buy_now_cents: number | null;
          starting_price_cents: number;
          current_lowest_bid_cents: number;
          duration_days: number;
          status: string;
          end_time: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          lister_id: string;
          title: string;
          description?: string | null;
          suburb: string;
          postcode: string;
          property_type: string;
          bedrooms: number;
          bathrooms: number;
          addons?: string[] | null;
          special_instructions?: string | null;
          move_out_date?: string | null;
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
        };
        Update: {
          title?: string;
          description?: string | null;
          suburb?: string;
          postcode?: string;
          property_type?: string;
          bedrooms?: number;
          bathrooms?: number;
          addons?: string[] | null;
          special_instructions?: string | null;
          move_out_date?: string | null;
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
      bids: {
        Row: {
          id: string;
          listing_id: string;
          cleaner_id: string;
          amount_cents: number;
          created_at: string;
          status: "active" | "cancelled";
        };
        Insert: {
          id?: string;
          listing_id: string;
          cleaner_id: string;
          amount_cents: number;
          created_at?: string;
          status?: "active" | "cancelled";
        };
        Update: {
          listing_id?: string;
          cleaner_id?: string;
          amount_cents?: number;
          created_at?: string;
          status?: "active" | "cancelled";
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
          payment_intent_id: string | null;
          payment_released_at: string | null;
          stripe_transfer_id: string | null;
          cleaner_confirmed_complete: boolean | null;
          cleaner_confirmed_at: string | null;
          auto_release_at: string | null;
          auto_release_at_original: string | null;
          completed_at: string | null;
          disputed_at: string | null;
          dispute_reason: string | null;
          dispute_photos: string[] | null;
          dispute_evidence: string[] | null;
          dispute_status: string | null;
          dispute_opened_by: string | null;
          proposed_refund_amount: number | null;
          counter_proposal_amount: number | null;
          dispute_resolution: string | null;
          resolution_type: string | null;
          resolution_at: string | null;
          resolution_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          listing_id: string;
          lister_id: string;
          winner_id?: string | null;
          status?: string;
          title?: string | null;
          agreed_amount_cents?: number | null;
          payment_intent_id?: string | null;
          payment_released_at?: string | null;
          stripe_transfer_id?: string | null;
          cleaner_confirmed_complete?: boolean | null;
          cleaner_confirmed_at?: string | null;
          auto_release_at?: string | null;
          auto_release_at_original?: string | null;
          completed_at?: string | null;
          disputed_at?: string | null;
          dispute_reason?: string | null;
          dispute_photos?: string[] | null;
          dispute_evidence?: string[] | null;
          dispute_status?: string | null;
          dispute_opened_by?: string | null;
          proposed_refund_amount?: number | null;
          counter_proposal_amount?: number | null;
          dispute_resolution?: string | null;
          resolution_type?: string | null;
          resolution_at?: string | null;
          resolution_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          listing_id?: string;
          lister_id?: string;
          winner_id?: string | null;
          status?: string;
          title?: string | null;
          agreed_amount_cents?: number | null;
          payment_intent_id?: string | null;
          payment_released_at?: string | null;
          stripe_transfer_id?: string | null;
          cleaner_confirmed_complete?: boolean | null;
          cleaner_confirmed_at?: string | null;
          auto_release_at?: string | null;
          auto_release_at_original?: string | null;
          completed_at?: string | null;
          disputed_at?: string | null;
          dispute_reason?: string | null;
          dispute_photos?: string[] | null;
          dispute_evidence?: string[] | null;
          dispute_status?: string | null;
          dispute_opened_by?: string | null;
          proposed_refund_amount?: number | null;
          counter_proposal_amount?: number | null;
          dispute_resolution?: string | null;
          resolution_type?: string | null;
          resolution_at?: string | null;
          resolution_by?: string | null;
          updated_at?: string;
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
      job_messages: {
        Row: {
          id: number;
          job_id: number;
          sender_id: string;
          message_text: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          job_id: number;
          sender_id: string;
          message_text: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          job_id?: number;
          sender_id?: string;
          message_text?: string;
          created_at?: string;
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
            | "referral_reward";
          job_id: number | null;
          message_text: string;
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
            | "referral_reward";
          job_id?: number | null;
          message_text: string;
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
            | "referral_reward";
          job_id?: number | null;
          message_text?: string;
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
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          sent_at?: string;
          subject?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          sent_at?: string;
          subject?: string | null;
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
          suggested_category: string | null;
          confidence: number | null;
          ai_reason: string | null;
          status: string;
          email: string | null;
          job_id: number | null;
          listing_id: string | null;
          attachment_urls: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject: string;
          description: string;
          category?: string;
          suggested_category?: string | null;
          confidence?: number | null;
          ai_reason?: string | null;
          status?: string;
          email?: string | null;
          job_id?: number | null;
          listing_id?: string | null;
          attachment_urls?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          subject?: string;
          description?: string;
          category?: string;
          suggested_category?: string | null;
          confidence?: number | null;
          ai_reason?: string | null;
          status?: string;
          email?: string | null;
          job_id?: number | null;
          listing_id?: string | null;
          attachment_urls?: string[] | null;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

