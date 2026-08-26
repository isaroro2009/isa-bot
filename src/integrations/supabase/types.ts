export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      academy_lessons: {
        Row: {
          body: string
          created_at: string
          emoji: string
          id: string
          level: number
          premium: boolean
          quiz: Json
          sort_order: number
          title: string
          track_slug: string
          xp: number
        }
        Insert: {
          body: string
          created_at?: string
          emoji?: string
          id?: string
          level?: number
          premium?: boolean
          quiz?: Json
          sort_order?: number
          title: string
          track_slug: string
          xp?: number
        }
        Update: {
          body?: string
          created_at?: string
          emoji?: string
          id?: string
          level?: number
          premium?: boolean
          quiz?: Json
          sort_order?: number
          title?: string
          track_slug?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "academy_lessons_track_slug_fkey"
            columns: ["track_slug"]
            isOneToOne: false
            referencedRelation: "academy_tracks"
            referencedColumns: ["slug"]
          },
        ]
      }
      academy_progress: {
        Row: {
          attempts: number
          completed_at: string
          correct: number
          id: string
          lesson_id: string
          status: string
          total: number
          track_slug: string
          user_id: string
          xp: number
        }
        Insert: {
          attempts?: number
          completed_at?: string
          correct?: number
          id?: string
          lesson_id: string
          status?: string
          total?: number
          track_slug: string
          user_id: string
          xp?: number
        }
        Update: {
          attempts?: number
          completed_at?: string
          correct?: number
          id?: string
          lesson_id?: string
          status?: string
          total?: number
          track_slug?: string
          user_id?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "academy_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_streaks: {
        Row: {
          best_streak: number
          hearts: number
          hearts_day: string | null
          last_day: string | null
          lessons_today: number
          streak: number
          today: string | null
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          best_streak?: number
          hearts?: number
          hearts_day?: string | null
          last_day?: string | null
          lessons_today?: number
          streak?: number
          today?: string | null
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          best_streak?: number
          hearts?: number
          hearts_day?: string | null
          last_day?: string | null
          lessons_today?: number
          streak?: number
          today?: string | null
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      academy_tracks: {
        Row: {
          created_at: string
          description: string
          emoji: string
          premium: boolean
          slug: string
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          description?: string
          emoji?: string
          premium?: boolean
          slug: string
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          emoji?: string
          premium?: boolean
          slug?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      b2b_leads: {
        Row: {
          company_name: string
          contact_name: string
          created_at: string
          email: string
          employees_range: string | null
          id: string
          phone: string | null
          source: string
          status: string
          use_case: string | null
        }
        Insert: {
          company_name: string
          contact_name: string
          created_at?: string
          email: string
          employees_range?: string | null
          id?: string
          phone?: string | null
          source?: string
          status?: string
          use_case?: string | null
        }
        Update: {
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          employees_range?: string | null
          id?: string
          phone?: string | null
          source?: string
          status?: string
          use_case?: string | null
        }
        Relationships: []
      }
      daily_plans: {
        Row: {
          available_minutes: number
          created_at: string
          energy: string
          focus_minutes: number
          id: string
          main_goal: string
          plan_date: string
          recap: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          available_minutes?: number
          created_at?: string
          energy?: string
          focus_minutes?: number
          id?: string
          main_goal: string
          plan_date?: string
          recap?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          available_minutes?: number
          created_at?: string
          energy?: string
          focus_minutes?: number
          id?: string
          main_goal?: string
          plan_date?: string
          recap?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_log: {
        Row: {
          created_at: string
          html: string | null
          id: string
          kind: string
          reason: string | null
          recipient: string
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          html?: string | null
          id?: string
          kind?: string
          reason?: string | null
          recipient: string
          status?: string
          subject: string
        }
        Update: {
          created_at?: string
          html?: string | null
          id?: string
          kind?: string
          reason?: string | null
          recipient?: string
          status?: string
          subject?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          rating: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          message: string
          rating?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          rating?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ibc_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ibc_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          refund_of: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string
          id?: string
          refund_of?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          refund_of?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ibc_transactions_refund_of_fkey"
            columns: ["refund_of"]
            isOneToOne: false
            referencedRelation: "ibc_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ibc_wallets: {
        Row: {
          balance: number
          created_at: string
          last_checkin_at: string | null
          plan_status: string
          streak_days: number
          unlimited_coins: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          last_checkin_at?: string | null
          plan_status?: string
          streak_days?: number
          unlimited_coins?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          last_checkin_at?: string | null
          plan_status?: string
          streak_days?: number
          unlimited_coins?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      isaspace_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "isaspace_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "isaspace_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      isaspace_imported: {
        Row: {
          author_avatar: string | null
          author_handle: string
          author_name: string
          content: string
          created_at: string
          external_id: string
          id: string
          image_url: string | null
          published_at: string
          source: string
          url: string
        }
        Insert: {
          author_avatar?: string | null
          author_handle: string
          author_name: string
          content: string
          created_at?: string
          external_id: string
          id?: string
          image_url?: string | null
          published_at?: string
          source?: string
          url: string
        }
        Update: {
          author_avatar?: string | null
          author_handle?: string
          author_name?: string
          content?: string
          created_at?: string
          external_id?: string
          id?: string
          image_url?: string | null
          published_at?: string
          source?: string
          url?: string
        }
        Relationships: []
      }
      isaspace_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "isaspace_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "isaspace_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      isaspace_posts: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      legacy_members: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          display_name: string
          email: string | null
          id: string
          invited_at: string | null
          plan_status: string
          starting_balance: number
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          invited_at?: string | null
          plan_status?: string
          starting_balance?: number
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          invited_at?: string | null
          plan_status?: string
          starting_balance?: number
        }
        Relationships: []
      }
      market_applications: {
        Row: {
          contact: string
          created_at: string
          id: string
          job_id: string
          message: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact?: string
          created_at?: string
          id?: string
          job_id: string
          message?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact?: string
          created_at?: string
          id?: string
          job_id?: string
          message?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "market_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      market_jobs: {
        Row: {
          budget: number
          category: string
          contact: string
          created_at: string
          currency: string
          description: string
          id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          budget?: number
          category?: string
          contact?: string
          created_at?: string
          currency?: string
          description?: string
          id?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: number
          category?: string
          contact?: string
          created_at?: string
          currency?: string
          description?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      market_services: {
        Row: {
          category: string
          contact: string
          created_at: string
          currency: string
          delivery_days: number
          description: string
          id: string
          price_from: number
          published: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          contact?: string
          created_at?: string
          currency?: string
          delivery_days?: number
          description?: string
          id?: string
          price_from?: number
          published?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          contact?: string
          created_at?: string
          currency?: string
          delivery_days?: number
          description?: string
          id?: string
          price_from?: number
          published?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mentor_applications: {
        Row: {
          contact: string
          created_at: string
          experience: string
          expertise: string
          full_name: string
          id: string
          links: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact: string
          created_at?: string
          experience: string
          expertise: string
          full_name: string
          id?: string
          links?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact?: string
          created_at?: string
          experience?: string
          expertise?: string
          full_name?: string
          id?: string
          links?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          bot_name: string
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          plan: string
          primary_color: string
          seats_limit: number
          secondary_color: string
          slug: string
          trial_ends_at: string
          updated_at: string
        }
        Insert: {
          bot_name?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          plan?: string
          primary_color?: string
          seats_limit?: number
          secondary_color?: string
          slug: string
          trial_ends_at?: string
          updated_at?: string
        }
        Update: {
          bot_name?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          plan?: string
          primary_color?: string
          seats_limit?: number
          secondary_color?: string
          slug?: string
          trial_ends_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      oryon_avatars: {
        Row: {
          accessory: string
          active_car: string | null
          active_pet: string | null
          created_at: string
          hair: string
          hair_style: string
          nick: string
          outfit: string
          pants: string
          pos_x: number
          pos_z: number
          skin: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accessory?: string
          active_car?: string | null
          active_pet?: string | null
          created_at?: string
          hair?: string
          hair_style?: string
          nick?: string
          outfit?: string
          pants?: string
          pos_x?: number
          pos_z?: number
          skin?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accessory?: string
          active_car?: string | null
          active_pet?: string | null
          created_at?: string
          hair?: string
          hair_style?: string
          nick?: string
          outfit?: string
          pants?: string
          pos_x?: number
          pos_z?: number
          skin?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      oryon_catalog: {
        Row: {
          active: boolean
          code: string
          color: string
          cost: number
          created_at: string
          emoji: string
          kind: string
          premium: boolean
          sort_order: number
          speed: number
          title: string
        }
        Insert: {
          active?: boolean
          code: string
          color?: string
          cost?: number
          created_at?: string
          emoji?: string
          kind: string
          premium?: boolean
          sort_order?: number
          speed?: number
          title: string
        }
        Update: {
          active?: boolean
          code?: string
          color?: string
          cost?: number
          created_at?: string
          emoji?: string
          kind?: string
          premium?: boolean
          sort_order?: number
          speed?: number
          title?: string
        }
        Relationships: []
      }
      oryon_garage: {
        Row: {
          created_at: string
          id: string
          item_code: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_code: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oryon_garage_item_code_fkey"
            columns: ["item_code"]
            isOneToOne: false
            referencedRelation: "oryon_catalog"
            referencedColumns: ["code"]
          },
        ]
      }
      oryon_houses: {
        Row: {
          created_at: string
          decorations: string[]
          door_color: string
          furniture: Json
          id: string
          lot: number
          name: string
          roof_color: string
          shape: string
          updated_at: string
          user_id: string
          wall_color: string
        }
        Insert: {
          created_at?: string
          decorations?: string[]
          door_color?: string
          furniture?: Json
          id?: string
          lot: number
          name?: string
          roof_color?: string
          shape?: string
          updated_at?: string
          user_id: string
          wall_color?: string
        }
        Update: {
          created_at?: string
          decorations?: string[]
          door_color?: string
          furniture?: Json
          id?: string
          lot?: number
          name?: string
          roof_color?: string
          shape?: string
          updated_at?: string
          user_id?: string
          wall_color?: string
        }
        Relationships: []
      }
      oryon_quests: {
        Row: {
          completed_at: string
          id: string
          quest_code: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          quest_code: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          quest_code?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_blocks: {
        Row: {
          created_at: string
          focus_minutes: number
          id: string
          kind: string
          minutes: number
          note: string | null
          plan_id: string
          skips: number
          sort_order: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          focus_minutes?: number
          id?: string
          kind?: string
          minutes?: number
          note?: string | null
          plan_id: string
          skips?: number
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          focus_minutes?: number
          id?: string
          kind?: string
          minutes?: number
          note?: string | null
          plan_id?: string
          skips?: number
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_blocks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "daily_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      point_events: {
        Row: {
          created_at: string
          delta: number
          id: string
          kind: string
          meta: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          kind: string
          meta?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          kind?: string
          meta?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          birthday: string | null
          created_at: string
          display_name: string | null
          email: string
          email_reminders_enabled: boolean
          focus_best_streak: number
          focus_streak: number
          headline: string | null
          id: string
          inactivity_emails_enabled: boolean
          interests: string[]
          is_premium: boolean
          last_active_at: string | null
          last_birthday_email_year: number | null
          last_inactivity_email_at: string | null
          last_plan_date: string | null
          last_seen_at: string | null
          last_weekly_digest_at: string | null
          location: string | null
          phone: string | null
          premium_expires_at: string | null
          premium_gift_days: number | null
          premium_notice_seen: boolean
          public_profile_enabled: boolean
          referral_code: string | null
          referred_by: string | null
          unsubscribe_token: string
          updated_at: string
          username: string | null
          welcome_email_sent_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          email_reminders_enabled?: boolean
          focus_best_streak?: number
          focus_streak?: number
          headline?: string | null
          id: string
          inactivity_emails_enabled?: boolean
          interests?: string[]
          is_premium?: boolean
          last_active_at?: string | null
          last_birthday_email_year?: number | null
          last_inactivity_email_at?: string | null
          last_plan_date?: string | null
          last_seen_at?: string | null
          last_weekly_digest_at?: string | null
          location?: string | null
          phone?: string | null
          premium_expires_at?: string | null
          premium_gift_days?: number | null
          premium_notice_seen?: boolean
          public_profile_enabled?: boolean
          referral_code?: string | null
          referred_by?: string | null
          unsubscribe_token?: string
          updated_at?: string
          username?: string | null
          welcome_email_sent_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          email_reminders_enabled?: boolean
          focus_best_streak?: number
          focus_streak?: number
          headline?: string | null
          id?: string
          inactivity_emails_enabled?: boolean
          interests?: string[]
          is_premium?: boolean
          last_active_at?: string | null
          last_birthday_email_year?: number | null
          last_inactivity_email_at?: string | null
          last_plan_date?: string | null
          last_seen_at?: string | null
          last_weekly_digest_at?: string | null
          location?: string | null
          phone?: string | null
          premium_expires_at?: string | null
          premium_gift_days?: number | null
          premium_notice_seen?: boolean
          public_profile_enabled?: boolean
          referral_code?: string | null
          referred_by?: string | null
          unsubscribe_token?: string
          updated_at?: string
          username?: string | null
          welcome_email_sent_at?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          activated_at: string | null
          created_at: string
          id: string
          invitee_id: string
          points_awarded: boolean
          premium_awarded: boolean
          referrer_id: string
          status: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          id?: string
          invitee_id: string
          points_awarded?: boolean
          premium_awarded?: boolean
          referrer_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          id?: string
          invitee_id?: string
          points_awarded?: boolean
          premium_awarded?: boolean
          referrer_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      rewards_catalog: {
        Row: {
          active: boolean
          asset_kind: string
          asset_url: string | null
          code: string
          cost: number
          created_at: string
          description: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          asset_kind: string
          asset_url?: string | null
          code: string
          cost: number
          created_at?: string
          description: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          asset_kind?: string
          asset_url?: string | null
          code?: string
          cost?: number
          created_at?: string
          description?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_campaigns: {
        Row: {
          active: boolean
          auto_send: boolean
          channels: string[]
          city: string
          created_at: string
          daily_limit: number
          id: string
          last_run_at: string | null
          name: string
          niche: string
          offer: string
          user_id: string
        }
        Insert: {
          active?: boolean
          auto_send?: boolean
          channels?: string[]
          city: string
          created_at?: string
          daily_limit?: number
          id?: string
          last_run_at?: string | null
          name: string
          niche: string
          offer: string
          user_id: string
        }
        Update: {
          active?: boolean
          auto_send?: boolean
          channels?: string[]
          city?: string
          created_at?: string
          daily_limit?: number
          id?: string
          last_run_at?: string | null
          name?: string
          niche?: string
          offer?: string
          user_id?: string
        }
        Relationships: []
      }
      sales_messages: {
        Row: {
          body: string
          campaign_id: string | null
          channel: string
          created_at: string
          id: string
          prospect_id: string
          sent_at: string | null
          status: string
          subject: string | null
          user_id: string
        }
        Insert: {
          body: string
          campaign_id?: string | null
          channel: string
          created_at?: string
          id?: string
          prospect_id: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          user_id: string
        }
        Update: {
          body?: string
          campaign_id?: string | null
          channel?: string
          created_at?: string
          id?: string
          prospect_id?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "sales_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_messages_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "sales_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_prospects: {
        Row: {
          address: string | null
          business_name: string
          campaign_id: string | null
          city: string | null
          created_at: string
          email: string | null
          id: string
          niche: string | null
          notes: string | null
          phone: string | null
          source: string
          status: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          business_name: string
          campaign_id?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          niche?: string | null
          notes?: string | null
          phone?: string | null
          source?: string
          status?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string
          campaign_id?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          niche?: string | null
          notes?: string | null
          phone?: string | null
          source?: string
          status?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_prospects_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "sales_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_docs: {
        Row: {
          content: Json
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_docs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "studio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_projects: {
        Row: {
          created_at: string
          id: string
          kind: string
          thumbnail: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          thumbnail?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          thumbnail?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tech_news: {
        Row: {
          created_at: string
          fetched_at: string
          id: string
          published_at: string
          source: string
          summary: string | null
          title: string
          title_es: string | null
          topic: string
          url: string
        }
        Insert: {
          created_at?: string
          fetched_at?: string
          id?: string
          published_at?: string
          source?: string
          summary?: string | null
          title: string
          title_es?: string | null
          topic?: string
          url: string
        }
        Update: {
          created_at?: string
          fetched_at?: string
          id?: string
          published_at?: string
          source?: string
          summary?: string | null
          title?: string
          title_es?: string | null
          topic?: string
          url?: string
        }
        Relationships: []
      }
      tech_news_digest: {
        Row: {
          created_at: string
          day: string
          summary: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day: string
          summary: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day?: string
          summary?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_memory: {
        Row: {
          created_at: string
          dislikes: string[]
          goals: string[]
          important: string[]
          likes: string[]
          mood: string | null
          mood_updated: string | null
          summary: string
          tone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dislikes?: string[]
          goals?: string[]
          important?: string[]
          likes?: string[]
          mood?: string | null
          mood_updated?: string | null
          summary?: string
          tone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dislikes?: string[]
          goals?: string[]
          important?: string[]
          likes?: string[]
          mood?: string | null
          mood_updated?: string | null
          summary?: string
          tone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_points: {
        Row: {
          created_at: string
          last_daily_award_at: string | null
          lifetime_points: number
          points: number
          signup_bonus_granted: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_daily_award_at?: string | null
          lifetime_points?: number
          points?: number
          signup_bonus_granted?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_daily_award_at?: string | null
          lifetime_points?: number
          points?: number
          signup_bonus_granted?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_reminders: {
        Row: {
          active: boolean
          created_at: string
          frequency: string
          id: string
          kind: string
          last_sent_at: string | null
          message: string | null
          once_date: string | null
          scheduled_at: string | null
          send_hour: number
          send_minute: number
          title: string
          updated_at: string
          user_id: string
          weekday: number | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          frequency?: string
          id?: string
          kind?: string
          last_sent_at?: string | null
          message?: string | null
          once_date?: string | null
          scheduled_at?: string | null
          send_hour?: number
          send_minute?: number
          title: string
          updated_at?: string
          user_id: string
          weekday?: number | null
        }
        Update: {
          active?: boolean
          created_at?: string
          frequency?: string
          id?: string
          kind?: string
          last_sent_at?: string | null
          message?: string | null
          once_date?: string | null
          scheduled_at?: string | null
          send_hour?: number
          send_minute?: number
          title?: string
          updated_at?: string
          user_id?: string
          weekday?: number | null
        }
        Relationships: []
      }
      user_rewards: {
        Row: {
          asset_url: string | null
          id: string
          redeemed_at: string
          reward_code: string
          user_id: string
        }
        Insert: {
          asset_url?: string | null
          id?: string
          redeemed_at?: string
          reward_code: string
          user_id: string
        }
        Update: {
          asset_url?: string | null
          id?: string
          redeemed_at?: string
          reward_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_rewards_reward_code_fkey"
            columns: ["reward_code"]
            isOneToOne: false
            referencedRelation: "rewards_catalog"
            referencedColumns: ["code"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_gifts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          kind: string
          message: string | null
          published_at: string | null
          queue_order: number
          status: string
          target_user_id: string | null
          title: string
          updated_at: string
          week_key: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          message?: string | null
          published_at?: string | null
          queue_order?: number
          status?: string
          target_user_id?: string | null
          title: string
          updated_at?: string
          week_key: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          message?: string | null
          published_at?: string | null
          queue_order?: number
          status?: string
          target_user_id?: string | null
          title?: string
          updated_at?: string
          week_key?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_points: {
        Args: { _kind: string }
        Returns: {
          delta: number
          lifetime_points: number
          points: number
        }[]
      }
      claim_referral: {
        Args: { _code: string }
        Returns: {
          message: string
          ok: boolean
        }[]
      }
      ensure_user_points_row: { Args: { _user_id: string }; Returns: undefined }
      has_org_role: {
        Args: {
          _org: string
          _roles: Database["public"]["Enums"]["org_role"][]
          _user: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      ibc_admin_grant: {
        Args: { _amount: number; _reason: string; _user_id: string }
        Returns: number
      }
      ibc_checkin: {
        Args: never
        Returns: {
          balance: number
          delta: number
          milestone: number
          streak_days: number
        }[]
      }
      ibc_ensure_wallet: {
        Args: never
        Returns: {
          balance: number
          created_at: string
          last_checkin_at: string | null
          plan_status: string
          streak_days: number
          unlimited_coins: boolean
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ibc_wallets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ibc_grant: {
        Args: { _amount: number; _reason: string }
        Returns: {
          balance: number
        }[]
      }
      ibc_refund: {
        Args: { _tx_id: string }
        Returns: {
          balance: number
          refunded: number
        }[]
      }
      ibc_spend: {
        Args: { _amount: number; _reason: string }
        Returns: {
          balance: number
          spent: number
          tx_id: string
        }[]
      }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
      is_premium_user: { Args: { _user_id: string }; Returns: boolean }
      redeem_reward: {
        Args: { _code: string }
        Returns: {
          asset_url: string
          points: number
          reward_code: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      org_role: "org_owner" | "org_admin" | "org_member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      org_role: ["org_owner", "org_admin", "org_member"],
    },
  },
} as const
