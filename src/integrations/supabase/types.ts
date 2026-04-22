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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string
          event_id: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string
          event_id?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string
          event_id?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      bar_selections: {
        Row: {
          bar_package: string | null
          beer_selection_1: string | null
          beer_selection_2: string | null
          champagne_arrival_upgrade: boolean | null
          champagne_welcome_toast: boolean | null
          event_id: string | null
          finalized: boolean | null
          high_noon_add_third: boolean | null
          high_noon_events: string | null
          high_noon_upgrade_1: boolean | null
          high_noon_upgrade_2: boolean | null
          id: string
          locked_by_brandon: boolean | null
          notes: string | null
          red_wine_1: string | null
          red_wine_2: string | null
          signature_drink_1: string | null
          signature_drink_2: string | null
          signature_drink_special_request: string | null
          updated_at: string | null
          welcome_drink_1: string | null
          welcome_drink_2: string | null
          welcome_drink_3: string | null
          white_wine_1: string | null
          white_wine_2: string | null
        }
        Insert: {
          bar_package?: string | null
          beer_selection_1?: string | null
          beer_selection_2?: string | null
          champagne_arrival_upgrade?: boolean | null
          champagne_welcome_toast?: boolean | null
          event_id?: string | null
          finalized?: boolean | null
          high_noon_add_third?: boolean | null
          high_noon_events?: string | null
          high_noon_upgrade_1?: boolean | null
          high_noon_upgrade_2?: boolean | null
          id?: string
          locked_by_brandon?: boolean | null
          notes?: string | null
          red_wine_1?: string | null
          red_wine_2?: string | null
          signature_drink_1?: string | null
          signature_drink_2?: string | null
          signature_drink_special_request?: string | null
          updated_at?: string | null
          welcome_drink_1?: string | null
          welcome_drink_2?: string | null
          welcome_drink_3?: string | null
          white_wine_1?: string | null
          white_wine_2?: string | null
        }
        Update: {
          bar_package?: string | null
          beer_selection_1?: string | null
          beer_selection_2?: string | null
          champagne_arrival_upgrade?: boolean | null
          champagne_welcome_toast?: boolean | null
          event_id?: string | null
          finalized?: boolean | null
          high_noon_add_third?: boolean | null
          high_noon_events?: string | null
          high_noon_upgrade_1?: boolean | null
          high_noon_upgrade_2?: boolean | null
          id?: string
          locked_by_brandon?: boolean | null
          notes?: string | null
          red_wine_1?: string | null
          red_wine_2?: string | null
          signature_drink_1?: string | null
          signature_drink_2?: string | null
          signature_drink_special_request?: string | null
          updated_at?: string | null
          welcome_drink_1?: string | null
          welcome_drink_2?: string | null
          welcome_drink_3?: string | null
          white_wine_1?: string | null
          white_wine_2?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bar_selections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      basics_cards: {
        Row: {
          bullets: Json
          card_type: string
          created_at: string
          group_label: string
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          bullets?: Json
          card_type?: string
          created_at?: string
          group_label: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          bullets?: Json
          card_type?: string
          created_at?: string
          group_label?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      builder_selections: {
        Row: {
          couple_id: string
          created_at: string
          id: string
          selections: Json
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          couple_id: string
          created_at?: string
          id?: string
          selections?: Json
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          couple_id?: string
          created_at?: string
          id?: string
          selections?: Json
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "builder_selections_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: true
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      ceremony_details: {
        Row: {
          cake_cutting_song: string | null
          ceremony_music_vendor: string | null
          couple_leading_to_cocktail: boolean | null
          couple_staying_for_photos: boolean | null
          dj_band_vendor: string | null
          dj_events_performing: Json | null
          dj_playlist_name: string | null
          dj_staying_for_afterparty: boolean | null
          event_id: string | null
          finalized: boolean | null
          first_dance_song: string | null
          formal_introductions: Json | null
          id: string
          intro_order: Json | null
          last_dance_song: string | null
          locked_by_brandon: boolean | null
          microphone_speakers: boolean | null
          microphone_type: string | null
          misc_notes: string | null
          musician_singer: string | null
          officiant_attending_rehearsal: boolean | null
          officiant_name: string | null
          officiant_relationship: string | null
          parent_dances: Json | null
          processional_order: Json | null
          recessional_song: string | null
          script_sent_to_brandon: boolean | null
          special_notes: string | null
          speeches_reception: Json | null
          speeches_rehearsal: Json | null
          updated_at: string | null
          wedding_party_altar_choice: string | null
          wedding_party_altar_notes: string | null
          welcome_toast_person: string | null
        }
        Insert: {
          cake_cutting_song?: string | null
          ceremony_music_vendor?: string | null
          couple_leading_to_cocktail?: boolean | null
          couple_staying_for_photos?: boolean | null
          dj_band_vendor?: string | null
          dj_events_performing?: Json | null
          dj_playlist_name?: string | null
          dj_staying_for_afterparty?: boolean | null
          event_id?: string | null
          finalized?: boolean | null
          first_dance_song?: string | null
          formal_introductions?: Json | null
          id?: string
          intro_order?: Json | null
          last_dance_song?: string | null
          locked_by_brandon?: boolean | null
          microphone_speakers?: boolean | null
          microphone_type?: string | null
          misc_notes?: string | null
          musician_singer?: string | null
          officiant_attending_rehearsal?: boolean | null
          officiant_name?: string | null
          officiant_relationship?: string | null
          parent_dances?: Json | null
          processional_order?: Json | null
          recessional_song?: string | null
          script_sent_to_brandon?: boolean | null
          special_notes?: string | null
          speeches_reception?: Json | null
          speeches_rehearsal?: Json | null
          updated_at?: string | null
          wedding_party_altar_choice?: string | null
          wedding_party_altar_notes?: string | null
          welcome_toast_person?: string | null
        }
        Update: {
          cake_cutting_song?: string | null
          ceremony_music_vendor?: string | null
          couple_leading_to_cocktail?: boolean | null
          couple_staying_for_photos?: boolean | null
          dj_band_vendor?: string | null
          dj_events_performing?: Json | null
          dj_playlist_name?: string | null
          dj_staying_for_afterparty?: boolean | null
          event_id?: string | null
          finalized?: boolean | null
          first_dance_song?: string | null
          formal_introductions?: Json | null
          id?: string
          intro_order?: Json | null
          last_dance_song?: string | null
          locked_by_brandon?: boolean | null
          microphone_speakers?: boolean | null
          microphone_type?: string | null
          misc_notes?: string | null
          musician_singer?: string | null
          officiant_attending_rehearsal?: boolean | null
          officiant_name?: string | null
          officiant_relationship?: string | null
          parent_dances?: Json | null
          processional_order?: Json | null
          recessional_song?: string | null
          script_sent_to_brandon?: boolean | null
          special_notes?: string | null
          speeches_reception?: Json | null
          speeches_rehearsal?: Json | null
          updated_at?: string | null
          wedding_party_altar_choice?: string | null
          wedding_party_altar_notes?: string | null
          welcome_toast_person?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ceremony_details_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          completed_at: string | null
          event_id: string | null
          id: string
          label: string
          milestone_id: string | null
          notes: string | null
          owner: string | null
          paced_send_date: string | null
          requires_addon: string | null
          section: string
          sort_order: number | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          event_id?: string | null
          id?: string
          label: string
          milestone_id?: string | null
          notes?: string | null
          owner?: string | null
          paced_send_date?: string | null
          requires_addon?: string | null
          section: string
          sort_order?: number | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          event_id?: string | null
          id?: string
          label?: string
          milestone_id?: string | null
          notes?: string | null
          owner?: string | null
          paced_send_date?: string | null
          requires_addon?: string | null
          section?: string
          sort_order?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_history: {
        Row: {
          action: string
          couple_id: string
          created_at: string
          details: Json | null
          id: string
        }
        Insert: {
          action: string
          couple_id: string
          created_at?: string
          details?: Json | null
          id?: string
        }
        Update: {
          action?: string
          couple_id?: string
          created_at?: string
          details?: Json | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "couple_history_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_notes: {
        Row: {
          body: string | null
          created_at: string | null
          created_by: string | null
          event_id: string | null
          id: string
          shared_with_brandon: boolean | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          created_by?: string | null
          event_id?: string | null
          id?: string
          shared_with_brandon?: boolean | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          created_by?: string | null
          event_id?: string | null
          id?: string
          shared_with_brandon?: boolean | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "couple_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_notes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_selections: {
        Row: {
          couple_id: string
          created_at: string
          group_label: string | null
          id: string
          menu_item_id: string
          notes: string | null
          section_id: string
        }
        Insert: {
          couple_id: string
          created_at?: string
          group_label?: string | null
          id?: string
          menu_item_id: string
          notes?: string | null
          section_id: string
        }
        Update: {
          couple_id?: string
          created_at?: string
          group_label?: string | null
          id?: string
          menu_item_id?: string
          notes?: string | null
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "couple_selections_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      couples: {
        Row: {
          created_at: string
          email: string
          guest_count: number | null
          id: string
          partner1_name: string
          partner2_name: string
          status: string
          updated_at: string
          user_id: string
          wedding_date: string | null
        }
        Insert: {
          created_at?: string
          email: string
          guest_count?: number | null
          id?: string
          partner1_name: string
          partner2_name: string
          status?: string
          updated_at?: string
          user_id: string
          wedding_date?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          guest_count?: number | null
          id?: string
          partner1_name?: string
          partner2_name?: string
          status?: string
          updated_at?: string
          user_id?: string
          wedding_date?: string | null
        }
        Relationships: []
      }
      decor_catalog: {
        Row: {
          available: boolean | null
          category: string
          created_at: string | null
          description: string | null
          id: string
          photo_url: string | null
          price_label: string | null
          price_per_unit: number
          sort_order: number | null
          title: string
        }
        Insert: {
          available?: boolean | null
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          photo_url?: string | null
          price_label?: string | null
          price_per_unit?: number
          sort_order?: number | null
          title: string
        }
        Update: {
          available?: boolean | null
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          photo_url?: string | null
          price_label?: string | null
          price_per_unit?: number
          sort_order?: number | null
          title?: string
        }
        Relationships: []
      }
      decor_selections: {
        Row: {
          added_by: string | null
          catalog_item_id: string | null
          created_at: string | null
          event_id: string | null
          id: string
          notes: string | null
          quantity: number
          total_price: number | null
          unit_price: number
        }
        Insert: {
          added_by?: string | null
          catalog_item_id?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          total_price?: number | null
          unit_price: number
        }
        Update: {
          added_by?: string | null
          catalog_item_id?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          total_price?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "decor_selections_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "decor_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decor_selections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      dietary_restrictions: {
        Row: {
          child_age: number | null
          created_at: string | null
          event_id: string | null
          guest_name: string | null
          has_restriction: boolean | null
          id: string
          is_child: boolean | null
          is_onsite: boolean | null
          notes: string | null
          other_meals: string | null
          reception_only: boolean | null
          restriction_type: string | null
          severity: string | null
          sort_order: number | null
        }
        Insert: {
          child_age?: number | null
          created_at?: string | null
          event_id?: string | null
          guest_name?: string | null
          has_restriction?: boolean | null
          id?: string
          is_child?: boolean | null
          is_onsite?: boolean | null
          notes?: string | null
          other_meals?: string | null
          reception_only?: boolean | null
          restriction_type?: string | null
          severity?: string | null
          sort_order?: number | null
        }
        Update: {
          child_age?: number | null
          created_at?: string | null
          event_id?: string | null
          guest_name?: string | null
          has_restriction?: boolean | null
          id?: string
          is_child?: boolean | null
          is_onsite?: boolean | null
          notes?: string | null
          other_meals?: string | null
          reception_only?: boolean | null
          restriction_type?: string | null
          severity?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dietary_restrictions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          description: string | null
          document_type: string | null
          event_id: string | null
          file_name: string
          file_url: string
          id: string
          uploaded_at: string | null
          uploaded_by: string | null
          vendor_id: string | null
        }
        Insert: {
          description?: string | null
          document_type?: string | null
          event_id?: string | null
          file_name: string
          file_url: string
          id?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          vendor_id?: string | null
        }
        Update: {
          description?: string | null
          document_type?: string | null
          event_id?: string | null
          file_name?: string
          file_url?: string
          id?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      event_addons: {
        Row: {
          addon: string
          event_id: string | null
          id: string
          included: boolean | null
        }
        Insert: {
          addon: string
          event_id?: string | null
          id?: string
          included?: boolean | null
        }
        Update: {
          addon?: string
          event_id?: string | null
          id?: string
          included?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "event_addons_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_users: {
        Row: {
          access_tier: number | null
          color: string | null
          display_name: string | null
          event_id: string | null
          id: string
          role_in_event: string
          tab_access: Json | null
          user_id: string | null
        }
        Insert: {
          access_tier?: number | null
          color?: string | null
          display_name?: string | null
          event_id?: string | null
          id?: string
          role_in_event: string
          tab_access?: Json | null
          user_id?: string | null
        }
        Update: {
          access_tier?: number | null
          color?: string | null
          display_name?: string | null
          event_id?: string | null
          id?: string
          role_in_event?: string
          tab_access?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_users_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          arrival_date: string | null
          arrival_date_note: string | null
          ceremony_location: string | null
          cocktail_hour_location: string | null
          count_at_30_days: number | null
          count_at_90_days: number | null
          created_at: string | null
          created_by: string | null
          decor_notes: string | null
          departure_date: string | null
          departure_date_note: string | null
          estimated_guest_count: number | null
          event_type: string
          how_heard: string | null
          id: string
          package_tier: string | null
          partner1_name: string | null
          partner2_name: string | null
          rehearsal_dinner_location: string | null
          status: string
          tasting_date: string | null
          tasting_date_note: string | null
          tasting_notes_internal: string | null
          title: string
          wedding_date: string | null
          wedding_date_note: string | null
        }
        Insert: {
          arrival_date?: string | null
          arrival_date_note?: string | null
          ceremony_location?: string | null
          cocktail_hour_location?: string | null
          count_at_30_days?: number | null
          count_at_90_days?: number | null
          created_at?: string | null
          created_by?: string | null
          decor_notes?: string | null
          departure_date?: string | null
          departure_date_note?: string | null
          estimated_guest_count?: number | null
          event_type?: string
          how_heard?: string | null
          id?: string
          package_tier?: string | null
          partner1_name?: string | null
          partner2_name?: string | null
          rehearsal_dinner_location?: string | null
          status?: string
          tasting_date?: string | null
          tasting_date_note?: string | null
          tasting_notes_internal?: string | null
          title: string
          wedding_date?: string | null
          wedding_date_note?: string | null
        }
        Update: {
          arrival_date?: string | null
          arrival_date_note?: string | null
          ceremony_location?: string | null
          cocktail_hour_location?: string | null
          count_at_30_days?: number | null
          count_at_90_days?: number | null
          created_at?: string | null
          created_by?: string | null
          decor_notes?: string | null
          departure_date?: string | null
          departure_date_note?: string | null
          estimated_guest_count?: number | null
          event_type?: string
          how_heard?: string | null
          id?: string
          package_tier?: string | null
          partner1_name?: string | null
          partner2_name?: string | null
          rehearsal_dinner_location?: string | null
          status?: string
          tasting_date?: string | null
          tasting_date_note?: string | null
          tasting_notes_internal?: string | null
          title?: string
          wedding_date?: string | null
          wedding_date_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_line_items: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          label: string
          quantity: number | null
          section: string
          sort_order: number | null
          source_id: string | null
          source_table: string | null
          total: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          label: string
          quantity?: number | null
          section: string
          sort_order?: number | null
          source_id?: string | null
          source_table?: string | null
          total?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          label?: string
          quantity?: number | null
          section?: string
          sort_order?: number | null
          source_id?: string | null
          source_table?: string | null
          total?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_line_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      financials: {
        Row: {
          catering_estimate: number | null
          catering_paid: number | null
          event_id: string | null
          id: string
          notes: string | null
          site_fee_paid: number | null
          site_fee_total: number | null
          updated_at: string | null
        }
        Insert: {
          catering_estimate?: number | null
          catering_paid?: number | null
          event_id?: string | null
          id?: string
          notes?: string | null
          site_fee_paid?: number | null
          site_fee_total?: number | null
          updated_at?: string | null
        }
        Update: {
          catering_estimate?: number | null
          catering_paid?: number | null
          event_id?: string | null
          id?: string
          notes?: string | null
          site_fee_paid?: number | null
          site_fee_total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financials_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      form_assignments: {
        Row: {
          created_at: string | null
          event_id: string | null
          form_id: string | null
          id: string
          status: string | null
          submitted_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          form_id?: string | null
          id?: string
          status?: string | null
          submitted_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          form_id?: string | null
          id?: string
          status?: string | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_assignments_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_responses: {
        Row: {
          assignment_id: string | null
          id: string
          responses: Json
          updated_at: string | null
        }
        Insert: {
          assignment_id?: string | null
          id?: string
          responses?: Json
          updated_at?: string | null
        }
        Update: {
          assignment_id?: string | null
          id?: string
          responses?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_responses_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "form_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          fields: Json
          id: string
          is_template: boolean | null
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          fields?: Json
          id?: string
          is_template?: boolean | null
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          fields?: Json
          id?: string
          is_template?: boolean | null
          title?: string
        }
        Relationships: []
      }
      gfh_resources: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          file_name: string | null
          file_url: string | null
          id: string
          sort_order: number | null
          title: string
          visible: boolean | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          sort_order?: number | null
          title: string
          visible?: boolean | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          sort_order?: number | null
          title?: string
          visible?: boolean | null
        }
        Relationships: []
      }
      guest_invitations: {
        Row: {
          created_at: string
          event_id: string
          guest_email: string
          guest_name: string
          id: string
          invite_group: string
          invited_by_couple_at: string
          last_accessed_at: string | null
          room_allocation: number
          rooms_booked: number
          secondary_booking_for: string | null
          section_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          guest_email: string
          guest_name: string
          id?: string
          invite_group?: string
          invited_by_couple_at?: string
          last_accessed_at?: string | null
          room_allocation?: number
          rooms_booked?: number
          secondary_booking_for?: string | null
          section_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          guest_email?: string
          guest_name?: string
          id?: string
          invite_group?: string
          invited_by_couple_at?: string
          last_accessed_at?: string | null
          room_allocation?: number
          rooms_booked?: number
          secondary_booking_for?: string | null
          section_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_invitations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "lb_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_invitations_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "lb_room_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      lb_bookings: {
        Row: {
          addon_amount: number
          addons_selected: Json
          base_amount: number
          booked_at: string
          event_id: string
          guest_email: string
          guest_name: string
          guest_phone: string | null
          id: string
          nights_booked: number
          payment_status: string
          resort_fee: number
          room_assignment: string | null
          section_id: string
          stripe_payment_id: string | null
          tax_amount: number
          total_amount: number
        }
        Insert: {
          addon_amount?: number
          addons_selected?: Json
          base_amount?: number
          booked_at?: string
          event_id: string
          guest_email: string
          guest_name: string
          guest_phone?: string | null
          id?: string
          nights_booked?: number
          payment_status?: string
          resort_fee?: number
          room_assignment?: string | null
          section_id: string
          stripe_payment_id?: string | null
          tax_amount?: number
          total_amount?: number
        }
        Update: {
          addon_amount?: number
          addons_selected?: Json
          base_amount?: number
          booked_at?: string
          event_id?: string
          guest_email?: string
          guest_name?: string
          guest_phone?: string | null
          id?: string
          nights_booked?: number
          payment_status?: string
          resort_fee?: number
          room_assignment?: string | null
          section_id?: string
          stripe_payment_id?: string | null
          tax_amount?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "lb_bookings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "lb_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lb_bookings_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "lb_room_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      lb_events: {
        Row: {
          check_in_date: string | null
          check_out_date: string | null
          couple_names: string
          created_at: string
          id: string
          nights: number
          resort_fee_pct: number
          status: string
          tax_pct: number
          updated_at: string
          wedding_date: string | null
          wedding_name: string
        }
        Insert: {
          check_in_date?: string | null
          check_out_date?: string | null
          couple_names: string
          created_at?: string
          id?: string
          nights?: number
          resort_fee_pct?: number
          status?: string
          tax_pct?: number
          updated_at?: string
          wedding_date?: string | null
          wedding_name: string
        }
        Update: {
          check_in_date?: string | null
          check_out_date?: string | null
          couple_names?: string
          created_at?: string
          id?: string
          nights?: number
          resort_fee_pct?: number
          status?: string
          tax_pct?: number
          updated_at?: string
          wedding_date?: string | null
          wedding_name?: string
        }
        Relationships: []
      }
      lb_room_sections: {
        Row: {
          booking_link_slug: string | null
          created_at: string
          event_id: string
          id: string
          is_active: boolean
          price_per_night: number
          section_name: string
          sort_order: number
          total_rooms: number
          updated_at: string
        }
        Insert: {
          booking_link_slug?: string | null
          created_at?: string
          event_id: string
          id?: string
          is_active?: boolean
          price_per_night?: number
          section_name: string
          sort_order?: number
          total_rooms?: number
          updated_at?: string
        }
        Update: {
          booking_link_slug?: string | null
          created_at?: string
          event_id?: string
          id?: string
          is_active?: boolean
          price_per_night?: number
          section_name?: string
          sort_order?: number
          total_rooms?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lb_room_sections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "lb_events"
            referencedColumns: ["id"]
          },
        ]
      }
      lb_section_addons: {
        Row: {
          addon_name: string
          addon_price: number
          addon_type: string
          created_at: string
          event_id: string
          id: string
          is_active: boolean
          is_required: boolean
          section_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          addon_name: string
          addon_price?: number
          addon_type?: string
          created_at?: string
          event_id: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          section_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          addon_name?: string
          addon_price?: number
          addon_type?: string
          created_at?: string
          event_id?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          section_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lb_section_addons_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "lb_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lb_section_addons_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "lb_room_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      lodging_assignments: {
        Row: {
          assigned_guest_email: string | null
          assigned_guest_name: string | null
          brandon_notes: string | null
          event_id: string | null
          host_pays: boolean | null
          id: string
          invoice_1_sent: boolean | null
          invoice_2_sent: boolean | null
          invoice_final_sent: boolean | null
          payment_completed_date: string | null
          payment_method: string | null
          payment_mode: string | null
          room_id: string | null
        }
        Insert: {
          assigned_guest_email?: string | null
          assigned_guest_name?: string | null
          brandon_notes?: string | null
          event_id?: string | null
          host_pays?: boolean | null
          id?: string
          invoice_1_sent?: boolean | null
          invoice_2_sent?: boolean | null
          invoice_final_sent?: boolean | null
          payment_completed_date?: string | null
          payment_method?: string | null
          payment_mode?: string | null
          room_id?: string | null
        }
        Update: {
          assigned_guest_email?: string | null
          assigned_guest_name?: string | null
          brandon_notes?: string | null
          event_id?: string | null
          host_pays?: boolean | null
          id?: string
          invoice_1_sent?: boolean | null
          invoice_2_sent?: boolean | null
          invoice_final_sent?: boolean | null
          payment_completed_date?: string | null
          payment_method?: string | null
          payment_mode?: string | null
          room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lodging_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lodging_assignments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "lodging_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      lodging_rooms: {
        Row: {
          id: string
          nightly_rate: number | null
          room_name: string
          room_type: string
          sort_order: number | null
        }
        Insert: {
          id?: string
          nightly_rate?: number | null
          room_name: string
          room_type: string
          sort_order?: number | null
        }
        Update: {
          id?: string
          nightly_rate?: number | null
          room_name?: string
          room_type?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      meal_events: {
        Row: {
          adult_count: number | null
          event_id: string | null
          id: string
          included_in_package: boolean | null
          kids_count: number | null
          location: string | null
          meal_type: string
          notes: string | null
          vendor_count: number | null
        }
        Insert: {
          adult_count?: number | null
          event_id?: string | null
          id?: string
          included_in_package?: boolean | null
          kids_count?: number | null
          location?: string | null
          meal_type: string
          notes?: string | null
          vendor_count?: number | null
        }
        Update: {
          adult_count?: number | null
          event_id?: string | null
          id?: string
          included_in_package?: boolean | null
          kids_count?: number | null
          location?: string | null
          meal_type?: string
          notes?: string | null
          vendor_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_accordions: {
        Row: {
          body: string
          created_at: string
          emoji: string | null
          id: string
          price: string | null
          section_id: string
          sort_order: number
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          emoji?: string | null
          id?: string
          price?: string | null
          section_id: string
          sort_order?: number
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          emoji?: string | null
          id?: string
          price?: string | null
          section_id?: string
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_accordions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "menu_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_guide: {
        Row: {
          body: string | null
          created_at: string
          id: string
          section_key: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          section_key: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          section_key?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          created_at: string
          description: string | null
          diet: string[] | null
          group_label: string | null
          id: string
          name: string
          note: string | null
          price: string | null
          season: string[] | null
          section_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          diet?: string[] | null
          group_label?: string | null
          id?: string
          name: string
          note?: string | null
          price?: string | null
          season?: string[] | null
          section_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          diet?: string[] | null
          group_label?: string | null
          id?: string
          name?: string
          note?: string | null
          price?: string | null
          season?: string[] | null
          section_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "menu_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_packages: {
        Row: {
          created_at: string
          description: string
          dietary_tags: string[] | null
          id: string
          is_featured: boolean | null
          price: string
          season: string[] | null
          section_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          dietary_tags?: string[] | null
          id?: string
          is_featured?: boolean | null
          price: string
          season?: string[] | null
          section_id: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          dietary_tags?: string[] | null
          id?: string
          is_featured?: boolean | null
          price?: string
          season?: string[] | null
          section_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_packages_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "menu_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_sections: {
        Row: {
          base_price_pp: number | null
          created_at: string
          description: string | null
          emoji: string | null
          id: string
          label: string
          section_subtitle: string | null
          section_title: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_price_pp?: number | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          id: string
          label: string
          section_subtitle?: string | null
          section_title: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_price_pp?: number | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          label?: string
          section_subtitle?: string | null
          section_title?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      message_notification_queue: {
        Row: {
          attempts: number | null
          created_at: string
          event_id: string
          id: string
          last_error: string | null
          messages_json: Json
          next_retry_at: string | null
          recipient_email: string
          recipient_role: string
          scheduled_send_at: string
          sent: boolean
          status: Database["public"]["Enums"]["notification_status"] | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string
          event_id: string
          id?: string
          last_error?: string | null
          messages_json?: Json
          next_retry_at?: string | null
          recipient_email: string
          recipient_role: string
          scheduled_send_at: string
          sent?: boolean
          status?: Database["public"]["Enums"]["notification_status"] | null
        }
        Update: {
          attempts?: number | null
          created_at?: string
          event_id?: string
          id?: string
          last_error?: string | null
          messages_json?: Json
          next_retry_at?: string | null
          recipient_email?: string
          recipient_role?: string
          scheduled_send_at?: string
          sent?: boolean
          status?: Database["public"]["Enums"]["notification_status"] | null
        }
        Relationships: []
      }
      message_reads: {
        Row: {
          event_user_id: string
          id: string
          message_id: string
          read_at: string | null
        }
        Insert: {
          event_user_id: string
          id?: string
          message_id: string
          read_at?: string | null
        }
        Update: {
          event_user_id?: string
          id?: string
          message_id?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_event_user_id_fkey"
            columns: ["event_user_id"]
            isOneToOne: false
            referencedRelation: "event_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string | null
          event_id: string | null
          id: string
          mentions: string[] | null
          read_at: string | null
          reply_to_message_id: string | null
          sender_event_user_id: string | null
          sender_id: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          event_id?: string | null
          id?: string
          mentions?: string[] | null
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_event_user_id?: string | null
          sender_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          event_id?: string | null
          id?: string
          mentions?: string[] | null
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_event_user_id?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_event_user_id_fkey"
            columns: ["sender_event_user_id"]
            isOneToOne: false
            referencedRelation: "event_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          completed_date: string | null
          created_at: string | null
          event_id: string | null
          id: string
          notes: string | null
          owner: string | null
          sort_order: number | null
          status: string | null
          target_date: string | null
          timeframe_label: string | null
          title: string
        }
        Insert: {
          completed_date?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          notes?: string | null
          owner?: string | null
          sort_order?: number | null
          status?: string | null
          target_date?: string | null
          timeframe_label?: string | null
          title: string
        }
        Update: {
          completed_date?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          notes?: string | null
          owner?: string | null
          sort_order?: number | null
          status?: string | null
          target_date?: string | null
          timeframe_label?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          event_id: string | null
          id: string
          milestone_id: string | null
          notification_type: string
          opened_at: string | null
          paced_send_date: string | null
          sent_at: string | null
          subject_line: string | null
          tasks_included: Json | null
          user_id: string | null
        }
        Insert: {
          event_id?: string | null
          id?: string
          milestone_id?: string | null
          notification_type: string
          opened_at?: string | null
          paced_send_date?: string | null
          sent_at?: string | null
          subject_line?: string | null
          tasks_included?: Json | null
          user_id?: string | null
        }
        Update: {
          event_id?: string | null
          id?: string
          milestone_id?: string | null
          notification_type?: string
          opened_at?: string | null
          paced_send_date?: string | null
          sent_at?: string | null
          subject_line?: string | null
          tasks_included?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      offsite_hotels: {
        Row: {
          active: boolean | null
          address: string | null
          amenities: string[] | null
          city: string
          coming_soon: boolean | null
          created_at: string | null
          distance_description: string | null
          distance_minutes: number | null
          id: string
          is_primary: boolean | null
          name: string
          notes: string | null
          phone: string | null
          sort_order: number | null
          website: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          amenities?: string[] | null
          city: string
          coming_soon?: boolean | null
          created_at?: string | null
          distance_description?: string | null
          distance_minutes?: number | null
          id?: string
          is_primary?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          sort_order?: number | null
          website?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          amenities?: string[] | null
          city?: string
          coming_soon?: boolean | null
          created_at?: string | null
          distance_description?: string | null
          distance_minutes?: number | null
          id?: string
          is_primary?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          sort_order?: number | null
          website?: string | null
        }
        Relationships: []
      }
      offsite_lodging: {
        Row: {
          block_code: string | null
          event_id: string | null
          guest_count: number | null
          hotel_id: string | null
          id: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          block_code?: string | null
          event_id?: string | null
          guest_count?: number | null
          hotel_id?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          block_code?: string | null
          event_id?: string | null
          guest_count?: number | null
          hotel_id?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offsite_lodging_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offsite_lodging_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "offsite_hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_schedule: {
        Row: {
          amount: number | null
          created_at: string | null
          due_date: string | null
          event_id: string | null
          id: string
          label: string
          method: string | null
          paid: boolean | null
          paid_date: string | null
          payment_number: number | null
          status: string | null
          track: string
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          due_date?: string | null
          event_id?: string | null
          id?: string
          label: string
          method?: string | null
          paid?: boolean | null
          paid_date?: string | null
          payment_number?: number | null
          status?: string | null
          track: string
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          due_date?: string | null
          event_id?: string | null
          id?: string
          label?: string
          method?: string | null
          paid?: boolean | null
          paid_date?: string | null
          payment_number?: number | null
          status?: string | null
          track?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedule_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      preferred_vendors: {
        Row: {
          active: boolean | null
          category: string
          contact_name: string | null
          created_at: string | null
          email: string | null
          family_favorite: boolean | null
          id: string
          instagram: string | null
          name: string
          notes: string | null
          phone: string | null
          sort_order: number | null
          subcategory: string | null
          tier: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          active?: boolean | null
          category: string
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          family_favorite?: boolean | null
          id?: string
          instagram?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          sort_order?: number | null
          subcategory?: string | null
          tier?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          family_favorite?: boolean | null
          id?: string
          instagram?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          sort_order?: number | null
          subcategory?: string | null
          tier?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      pricing_config: {
        Row: {
          category: string
          created_at: string
          id: string
          included_count: number | null
          is_active: boolean
          item_key: string
          item_label: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          included_count?: number | null
          is_active?: boolean
          item_key: string
          item_label: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          included_count?: number | null
          is_active?: boolean
          item_key?: string
          item_label?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      section_group_limits: {
        Row: {
          created_at: string
          extra_price_note: string | null
          extra_price_pp: number | null
          group_label: string
          id: string
          included_count: number
          section_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          extra_price_note?: string | null
          extra_price_pp?: number | null
          group_label: string
          id?: string
          included_count?: number
          section_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          extra_price_note?: string | null
          extra_price_pp?: number | null
          group_label?: string
          id?: string
          included_count?: number
          section_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_group_limits_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "menu_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          is_gfh_internal: boolean
          last_name: string | null
          phone: string | null
          role: string
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name?: string | null
          id: string
          is_gfh_internal?: boolean
          last_name?: string | null
          phone?: string | null
          role?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          is_gfh_internal?: boolean
          last_name?: string | null
          phone?: string | null
          role?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          brandon_notes: string | null
          business_name: string | null
          category: string
          coi_received: boolean | null
          contact_name: string | null
          contract_uploaded: boolean | null
          created_at: string | null
          email: string | null
          event_id: string | null
          id: string
          info_emailed: boolean | null
          instagram: string | null
          phone: string | null
          sort_order: number | null
          status: string | null
          vendor_meals: number | null
        }
        Insert: {
          brandon_notes?: string | null
          business_name?: string | null
          category: string
          coi_received?: boolean | null
          contact_name?: string | null
          contract_uploaded?: boolean | null
          created_at?: string | null
          email?: string | null
          event_id?: string | null
          id?: string
          info_emailed?: boolean | null
          instagram?: string | null
          phone?: string | null
          sort_order?: number | null
          status?: string | null
          vendor_meals?: number | null
        }
        Update: {
          brandon_notes?: string | null
          business_name?: string | null
          category?: string
          coi_received?: boolean | null
          contact_name?: string | null
          contract_uploaded?: boolean | null
          created_at?: string | null
          email?: string | null
          event_id?: string | null
          id?: string
          info_emailed?: boolean | null
          instagram?: string | null
          phone?: string | null
          sort_order?: number | null
          status?: string | null
          vendor_meals?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      working_timeline: {
        Row: {
          event_id: string | null
          id: string
          last_updated: string | null
          published: boolean | null
          timeline_data: Json | null
        }
        Insert: {
          event_id?: string | null
          id?: string
          last_updated?: string | null
          published?: boolean | null
          timeline_data?: Json | null
        }
        Update: {
          event_id?: string | null
          id?: string
          last_updated?: string | null
          published?: boolean | null
          timeline_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "working_timeline_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_event_member: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      lb_ensure_block_for_event: {
        Args: { _event_id: string }
        Returns: string
      }
      seed_checklist: { Args: { p_event_id: string }; Returns: undefined }
      seed_milestones: {
        Args: { p_event_id: string; p_wedding_date: string }
        Returns: undefined
      }
      seed_planning_timeline: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      seed_vendors: { Args: { p_event_id: string }; Returns: undefined }
      seed_working_timeline: {
        Args: { p_event_id: string }
        Returns: undefined
      }
    }
    Enums: {
      notification_status: "pending" | "sent" | "failed" | "permanent_failure"
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
      notification_status: ["pending", "sent", "failed", "permanent_failure"],
    },
  },
} as const
