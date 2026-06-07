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
      contract_signatures: {
        Row: {
          agreed_to_terms: boolean
          auth_method: string
          content_version_hash: string
          contract_id: string | null
          id: string
          ip_address: string | null
          signed_at: string
          signer_email: string
          signer_name: string
          signer_user_id: string | null
          typed_name: string
          user_agent: string | null
        }
        Insert: {
          agreed_to_terms?: boolean
          auth_method?: string
          content_version_hash: string
          contract_id?: string | null
          id?: string
          ip_address?: string | null
          signed_at?: string
          signer_email: string
          signer_name: string
          signer_user_id?: string | null
          typed_name: string
          user_agent?: string | null
        }
        Update: {
          agreed_to_terms?: boolean
          auth_method?: string
          content_version_hash?: string
          contract_id?: string | null
          id?: string
          ip_address?: string | null
          signed_at?: string
          signer_email?: string
          signer_name?: string
          signer_user_id?: string | null
          typed_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          content: string
          content_hash: string | null
          created_at: string | null
          created_by: string | null
          document_type: string | null
          event_id: string | null
          id: string
          requires_both_partners: boolean | null
          sent_at: string | null
          status: string | null
          title: string
        }
        Insert: {
          content: string
          content_hash?: string | null
          created_at?: string | null
          created_by?: string | null
          document_type?: string | null
          event_id?: string | null
          id?: string
          requires_both_partners?: boolean | null
          sent_at?: string | null
          status?: string | null
          title: string
        }
        Update: {
          content?: string
          content_hash?: string | null
          created_at?: string | null
          created_by?: string | null
          document_type?: string | null
          event_id?: string | null
          id?: string
          requires_both_partners?: boolean | null
          sent_at?: string | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
      email_sender_map: {
        Row: {
          event_id: string | null
          id: string
          last_filed_at: string | null
          sender_address: string
          times_filed: number | null
          vendor_category: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Insert: {
          event_id?: string | null
          id?: string
          last_filed_at?: string | null
          sender_address: string
          times_filed?: number | null
          vendor_category?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Update: {
          event_id?: string | null
          id?: string
          last_filed_at?: string | null
          sender_address?: string
          times_filed?: number | null
          vendor_category?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sender_map_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
      experience_catalog: {
        Row: {
          available: boolean | null
          category: string
          created_at: string | null
          description: string | null
          id: string
          photo_url: string | null
          pricing_config: Json | null
          pricing_type: string | null
          pricing_visible_to_couple: boolean | null
          requires_discussion: boolean | null
          sort_order: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          available?: boolean | null
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          photo_url?: string | null
          pricing_config?: Json | null
          pricing_type?: string | null
          pricing_visible_to_couple?: boolean | null
          requires_discussion?: boolean | null
          sort_order?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          available?: boolean | null
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          photo_url?: string | null
          pricing_config?: Json | null
          pricing_type?: string | null
          pricing_visible_to_couple?: boolean | null
          requires_discussion?: boolean | null
          sort_order?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      experience_requests: {
        Row: {
          approved_at: string | null
          brandon_notes: string | null
          catalog_item_id: string | null
          couple_notes: string | null
          created_at: string | null
          decline_reason: string | null
          event_id: string
          final_price: number | null
          final_price_label: string | null
          guest_count: number | null
          hours: number | null
          id: string
          preferred_day: string | null
          selected_tier: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          brandon_notes?: string | null
          catalog_item_id?: string | null
          couple_notes?: string | null
          created_at?: string | null
          decline_reason?: string | null
          event_id: string
          final_price?: number | null
          final_price_label?: string | null
          guest_count?: number | null
          hours?: number | null
          id?: string
          preferred_day?: string | null
          selected_tier?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          brandon_notes?: string | null
          catalog_item_id?: string | null
          couple_notes?: string | null
          created_at?: string | null
          decline_reason?: string | null
          event_id?: string
          final_price?: number | null
          final_price_label?: string | null
          guest_count?: number | null
          hours?: number | null
          id?: string
          preferred_day?: string | null
          selected_tier?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "experience_requests_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "experience_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experience_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      filed_threads: {
        Row: {
          event_id: string
          filed_at: string
          filed_by: string | null
          gmail_thread_id: string
          id: string
          last_synced_at: string | null
        }
        Insert: {
          event_id: string
          filed_at?: string
          filed_by?: string | null
          gmail_thread_id: string
          id?: string
          last_synced_at?: string | null
        }
        Update: {
          event_id?: string
          filed_at?: string
          filed_by?: string | null
          gmail_thread_id?: string
          id?: string
          last_synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "filed_threads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
      gmail_connections: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          connected_at: string
          email_address: string | null
          id: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          connected_at?: string
          email_address?: string | null
          id?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          connected_at?: string
          email_address?: string | null
          id?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      guest_dietary_entries: {
        Row: {
          applies_to_meals: string[] | null
          created_at: string
          event_id: string
          guest_id: string | null
          id: string
          notes: string | null
          restriction: string
          restriction_type: string | null
          severity: string | null
          updated_at: string
        }
        Insert: {
          applies_to_meals?: string[] | null
          created_at?: string
          event_id: string
          guest_id?: string | null
          id?: string
          notes?: string | null
          restriction: string
          restriction_type?: string | null
          severity?: string | null
          updated_at?: string
        }
        Update: {
          applies_to_meals?: string[] | null
          created_at?: string
          event_id?: string
          guest_id?: string | null
          id?: string
          notes?: string | null
          restriction?: string
          restriction_type?: string | null
          severity?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_dietary_entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_dietary_entries_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
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
      guests: {
        Row: {
          added_by: string | null
          created_at: string | null
          dietary_restrictions: string[] | null
          email: string | null
          event_id: string
          first_name: string
          id: string
          is_plus_one: boolean | null
          last_name: string
          lodging_preference: string | null
          meal_preference: string | null
          needs_assistance: boolean
          needs_wheelchair: boolean
          notes: string | null
          party_size: number
          phone: string | null
          plus_one_of: string | null
          relationship: string | null
          rsvp_lodging_details: Json
          rsvp_responses: Json
          rsvp_source: string | null
          rsvp_status: string | null
          rsvp_submitted_at: string | null
          rsvp_token: string | null
          side: string | null
          updated_at: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string | null
          dietary_restrictions?: string[] | null
          email?: string | null
          event_id: string
          first_name: string
          id?: string
          is_plus_one?: boolean | null
          last_name: string
          lodging_preference?: string | null
          meal_preference?: string | null
          needs_assistance?: boolean
          needs_wheelchair?: boolean
          notes?: string | null
          party_size?: number
          phone?: string | null
          plus_one_of?: string | null
          relationship?: string | null
          rsvp_lodging_details?: Json
          rsvp_responses?: Json
          rsvp_source?: string | null
          rsvp_status?: string | null
          rsvp_submitted_at?: string | null
          rsvp_token?: string | null
          side?: string | null
          updated_at?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string | null
          dietary_restrictions?: string[] | null
          email?: string | null
          event_id?: string
          first_name?: string
          id?: string
          is_plus_one?: boolean | null
          last_name?: string
          lodging_preference?: string | null
          meal_preference?: string | null
          needs_assistance?: boolean
          needs_wheelchair?: boolean
          notes?: string | null
          party_size?: number
          phone?: string | null
          plus_one_of?: string | null
          relationship?: string | null
          rsvp_lodging_details?: Json
          rsvp_responses?: Json
          rsvp_source?: string | null
          rsvp_status?: string | null
          rsvp_submitted_at?: string | null
          rsvp_token?: string | null
          side?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guests_plus_one_of_fkey"
            columns: ["plus_one_of"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      layout_library: {
        Row: {
          created_at: string | null
          guest_count_max: number
          guest_count_min: number
          id: string
          image_url: string | null
          is_active: boolean | null
          label: string
          sort_order: number | null
          table_config_description: string | null
        }
        Insert: {
          created_at?: string | null
          guest_count_max: number
          guest_count_min: number
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          label: string
          sort_order?: number | null
          table_config_description?: string | null
        }
        Update: {
          created_at?: string | null
          guest_count_max?: number
          guest_count_min?: number
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
          table_config_description?: string | null
        }
        Relationships: []
      }
      lb_activity_log: {
        Row: {
          action: string
          actor: string
          actor_name: string | null
          booking_id: string | null
          created_at: string
          event_id: string | null
          id: string
          label: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor: string
          actor_name?: string | null
          booking_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          label: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor?: string
          actor_name?: string | null
          booking_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          label?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "lb_activity_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "lb_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lb_activity_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "lb_events"
            referencedColumns: ["id"]
          },
        ]
      }
      lb_additional_charges: {
        Row: {
          amount: number
          booking_id: string
          charged_at: string
          charged_by: string | null
          description: string
          event_id: string
          id: string
          notes: string | null
          status: string
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          charged_at?: string
          charged_by?: string | null
          description: string
          event_id: string
          id?: string
          notes?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          charged_at?: string
          charged_by?: string | null
          description?: string
          event_id?: string
          id?: string
          notes?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lb_additional_charges_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "lb_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lb_additional_charges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "lb_events"
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
          checkin_reminder_sent: boolean
          checkin_reminder_sent_at: string | null
          cot_fee: number
          cot_requested: boolean
          covered_at: string | null
          covered_by_booking_id: string | null
          deposit_paid_at: string | null
          event_id: string
          final_paid_at: string | null
          guest_email: string
          guest_name: string
          guest_phone: string | null
          id: string
          is_primary: boolean
          nights_booked: number
          payment_schedule: string
          payment_status: string
          payment_update_token: string | null
          payment_update_token_expires_at: string | null
          refund_amount: number | null
          refund_notes: string | null
          refund_reason: string | null
          refunded_at: string | null
          refunded_by: string | null
          reminder_count: number
          reminder_sent_at: string | null
          removed: boolean
          removed_at: string | null
          resort_fee: number
          room_assignment: string | null
          section_id: string
          stripe_customer_id: string | null
          stripe_payment_id: string | null
          stripe_payment_intent_id: string | null
          stripe_payment_method_id: string | null
          stripe_refund_id: string | null
          stripe_session_id: string | null
          tax_amount: number
          total_amount: number
        }
        Insert: {
          addon_amount?: number
          addons_selected?: Json
          base_amount?: number
          booked_at?: string
          checkin_reminder_sent?: boolean
          checkin_reminder_sent_at?: string | null
          cot_fee?: number
          cot_requested?: boolean
          covered_at?: string | null
          covered_by_booking_id?: string | null
          deposit_paid_at?: string | null
          event_id: string
          final_paid_at?: string | null
          guest_email: string
          guest_name: string
          guest_phone?: string | null
          id?: string
          is_primary?: boolean
          nights_booked?: number
          payment_schedule?: string
          payment_status?: string
          payment_update_token?: string | null
          payment_update_token_expires_at?: string | null
          refund_amount?: number | null
          refund_notes?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          reminder_count?: number
          reminder_sent_at?: string | null
          removed?: boolean
          removed_at?: string | null
          resort_fee?: number
          room_assignment?: string | null
          section_id: string
          stripe_customer_id?: string | null
          stripe_payment_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_refund_id?: string | null
          stripe_session_id?: string | null
          tax_amount?: number
          total_amount?: number
        }
        Update: {
          addon_amount?: number
          addons_selected?: Json
          base_amount?: number
          booked_at?: string
          checkin_reminder_sent?: boolean
          checkin_reminder_sent_at?: string | null
          cot_fee?: number
          cot_requested?: boolean
          covered_at?: string | null
          covered_by_booking_id?: string | null
          deposit_paid_at?: string | null
          event_id?: string
          final_paid_at?: string | null
          guest_email?: string
          guest_name?: string
          guest_phone?: string | null
          id?: string
          is_primary?: boolean
          nights_booked?: number
          payment_schedule?: string
          payment_status?: string
          payment_update_token?: string | null
          payment_update_token_expires_at?: string | null
          refund_amount?: number | null
          refund_notes?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          reminder_count?: number
          reminder_sent_at?: string | null
          removed?: boolean
          removed_at?: string | null
          resort_fee?: number
          room_assignment?: string | null
          section_id?: string
          stripe_customer_id?: string | null
          stripe_payment_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_refund_id?: string | null
          stripe_session_id?: string | null
          tax_amount?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "lb_bookings_covered_by_booking_id_fkey"
            columns: ["covered_by_booking_id"]
            isOneToOne: false
            referencedRelation: "lb_bookings"
            referencedColumns: ["id"]
          },
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
          check_in_time: string
          check_out_date: string | null
          check_out_time: string
          couple_access_token: string
          couple_names: string
          created_at: string
          id: string
          nights: number
          resort_fee_pct: number
          slug: string | null
          status: string
          tax_pct: number
          updated_at: string
          wedding_date: string | null
          wedding_name: string
        }
        Insert: {
          check_in_date?: string | null
          check_in_time?: string
          check_out_date?: string | null
          check_out_time?: string
          couple_access_token?: string
          couple_names: string
          created_at?: string
          id?: string
          nights?: number
          resort_fee_pct?: number
          slug?: string | null
          status?: string
          tax_pct?: number
          updated_at?: string
          wedding_date?: string | null
          wedding_name: string
        }
        Update: {
          check_in_date?: string | null
          check_in_time?: string
          check_out_date?: string | null
          check_out_time?: string
          couple_access_token?: string
          couple_names?: string
          created_at?: string
          id?: string
          nights?: number
          resort_fee_pct?: number
          slug?: string | null
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
          cot_1night_rate: number
          cot_2night_rate: number
          couple_contribution: number
          created_at: string
          custom_contributions: Json | null
          event_id: string
          guest_nightly_rate: number | null
          id: string
          internal_nightly_rate: number
          is_active: boolean
          nights: number
          payment_schedule: string
          price_per_night: number
          processing_fee_percent: number
          resort_fee_percent: number
          section_name: string
          sort_order: number
          tax_percent: number
          total_rooms: number
          updated_at: string
        }
        Insert: {
          booking_link_slug?: string | null
          cot_1night_rate?: number
          cot_2night_rate?: number
          couple_contribution?: number
          created_at?: string
          custom_contributions?: Json | null
          event_id: string
          guest_nightly_rate?: number | null
          id?: string
          internal_nightly_rate?: number
          is_active?: boolean
          nights?: number
          payment_schedule?: string
          price_per_night?: number
          processing_fee_percent?: number
          resort_fee_percent?: number
          section_name: string
          sort_order?: number
          tax_percent?: number
          total_rooms?: number
          updated_at?: string
        }
        Update: {
          booking_link_slug?: string | null
          cot_1night_rate?: number
          cot_2night_rate?: number
          couple_contribution?: number
          created_at?: string
          custom_contributions?: Json | null
          event_id?: string
          guest_nightly_rate?: number | null
          id?: string
          internal_nightly_rate?: number
          is_active?: boolean
          nights?: number
          payment_schedule?: string
          price_per_night?: number
          processing_fee_percent?: number
          resort_fee_percent?: number
          section_name?: string
          sort_order?: number
          tax_percent?: number
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
      lb_sync_log: {
        Row: {
          action: string
          created_at: string
          direction: string
          event_id: string | null
          guest_email: string | null
          id: string
          lb_booking_id: string | null
          lodging_assignment_id: string | null
          reason: string | null
        }
        Insert: {
          action: string
          created_at?: string
          direction: string
          event_id?: string | null
          guest_email?: string | null
          id?: string
          lb_booking_id?: string | null
          lodging_assignment_id?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          direction?: string
          event_id?: string | null
          guest_email?: string | null
          id?: string
          lb_booking_id?: string | null
          lodging_assignment_id?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      lodging_assignments: {
        Row: {
          assigned_guest_email: string | null
          assigned_guest_name: string | null
          brandon_notes: string | null
          deposit_paid_at: string | null
          event_id: string | null
          final_paid_at: string | null
          host_pays: boolean | null
          id: string
          invoice_1_sent: boolean | null
          invoice_2_sent: boolean | null
          invoice_final_sent: boolean | null
          payment_completed_date: string | null
          payment_method: string | null
          payment_mode: string | null
          payment_status: string | null
          removed: boolean
          removed_at: string | null
          room_id: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
        }
        Insert: {
          assigned_guest_email?: string | null
          assigned_guest_name?: string | null
          brandon_notes?: string | null
          deposit_paid_at?: string | null
          event_id?: string | null
          final_paid_at?: string | null
          host_pays?: boolean | null
          id?: string
          invoice_1_sent?: boolean | null
          invoice_2_sent?: boolean | null
          invoice_final_sent?: boolean | null
          payment_completed_date?: string | null
          payment_method?: string | null
          payment_mode?: string | null
          payment_status?: string | null
          removed?: boolean
          removed_at?: string | null
          room_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          assigned_guest_email?: string | null
          assigned_guest_name?: string | null
          brandon_notes?: string | null
          deposit_paid_at?: string | null
          event_id?: string | null
          final_paid_at?: string | null
          host_pays?: boolean | null
          id?: string
          invoice_1_sent?: boolean | null
          invoice_2_sent?: boolean | null
          invoice_final_sent?: boolean | null
          payment_completed_date?: string | null
          payment_method?: string | null
          payment_mode?: string | null
          payment_status?: string | null
          removed?: boolean
          removed_at?: string | null
          room_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
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
          created_at: string
          event_id: string | null
          id: string
          message: string | null
          milestone_id: string | null
          notification_type: string
          opened_at: string | null
          paced_send_date: string | null
          sent_at: string | null
          subject_line: string | null
          tasks_included: Json | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          message?: string | null
          milestone_id?: string | null
          notification_type: string
          opened_at?: string | null
          paced_send_date?: string | null
          sent_at?: string | null
          subject_line?: string | null
          tasks_included?: Json | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          message?: string | null
          milestone_id?: string | null
          notification_type?: string
          opened_at?: string | null
          paced_send_date?: string | null
          sent_at?: string | null
          subject_line?: string | null
          tasks_included?: Json | null
          type?: string | null
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
      payment_settings: {
        Row: {
          account_name: string | null
          account_number: string | null
          additional_instructions: string | null
          bank_name: string | null
          created_at: string
          id: string
          routing_number: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          additional_instructions?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          routing_number?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          additional_instructions?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          routing_number?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
      project_emails: {
        Row: {
          attachments: Json | null
          body_html: string | null
          body_text: string | null
          direction: string | null
          event_id: string
          filed_at: string
          filed_by: string | null
          from_address: string | null
          from_name: string | null
          gmail_message_id: string
          gmail_thread_id: string
          has_attachments: boolean | null
          id: string
          matched_vendor_id: string | null
          matched_vendor_name: string | null
          received_at: string | null
          snippet: string | null
          subject: string | null
          to_addresses: string | null
          vendor_category: string | null
        }
        Insert: {
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          direction?: string | null
          event_id: string
          filed_at?: string
          filed_by?: string | null
          from_address?: string | null
          from_name?: string | null
          gmail_message_id: string
          gmail_thread_id: string
          has_attachments?: boolean | null
          id?: string
          matched_vendor_id?: string | null
          matched_vendor_name?: string | null
          received_at?: string | null
          snippet?: string | null
          subject?: string | null
          to_addresses?: string | null
          vendor_category?: string | null
        }
        Update: {
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          direction?: string | null
          event_id?: string
          filed_at?: string
          filed_by?: string | null
          from_address?: string | null
          from_name?: string | null
          gmail_message_id?: string
          gmail_thread_id?: string
          has_attachments?: boolean | null
          id?: string
          matched_vendor_id?: string | null
          matched_vendor_name?: string | null
          received_at?: string | null
          snippet?: string | null
          subject?: string | null
          to_addresses?: string | null
          vendor_category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_emails_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      role_change_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          changed_user_id: string | null
          id: string
          new_role: string | null
          old_role: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          changed_user_id?: string | null
          id?: string
          new_role?: string | null
          old_role?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changed_user_id?: string | null
          id?: string
          new_role?: string | null
          old_role?: string | null
        }
        Relationships: []
      }
      rsvp_config: {
        Row: {
          ask_dietary: boolean
          ask_meal_preference: boolean
          ask_song_request: boolean
          color_accent: string
          color_primary: string
          color_secondary: string
          conditional_reminders: Json
          confirmation_message: string | null
          created_at: string
          custom_questions: Json
          event_id: string
          id: string
          is_live: boolean
          offsite_questions: Json
          onsite_questions: Json
          public_token: string | null
          rsvp_deadline: string | null
          updated_at: string
          welcome_headline: string | null
          welcome_message: string | null
        }
        Insert: {
          ask_dietary?: boolean
          ask_meal_preference?: boolean
          ask_song_request?: boolean
          color_accent?: string
          color_primary?: string
          color_secondary?: string
          conditional_reminders?: Json
          confirmation_message?: string | null
          created_at?: string
          custom_questions?: Json
          event_id: string
          id?: string
          is_live?: boolean
          offsite_questions?: Json
          onsite_questions?: Json
          public_token?: string | null
          rsvp_deadline?: string | null
          updated_at?: string
          welcome_headline?: string | null
          welcome_message?: string | null
        }
        Update: {
          ask_dietary?: boolean
          ask_meal_preference?: boolean
          ask_song_request?: boolean
          color_accent?: string
          color_primary?: string
          color_secondary?: string
          conditional_reminders?: Json
          confirmation_message?: string | null
          created_at?: string
          custom_questions?: Json
          event_id?: string
          id?: string
          is_live?: boolean
          offsite_questions?: Json
          onsite_questions?: Json
          public_token?: string | null
          rsvp_deadline?: string | null
          updated_at?: string
          welcome_headline?: string | null
          welcome_message?: string | null
        }
        Relationships: []
      }
      sales_details: {
        Row: {
          created_at: string
          date_booked: string | null
          entered_by: string | null
          event_id: string
          id: string
          lead_source: string | null
          original_catering_estimate: number | null
          original_guest_estimate: number | null
          original_quote: number | null
          stated_budget: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_booked?: string | null
          entered_by?: string | null
          event_id: string
          id?: string
          lead_source?: string | null
          original_catering_estimate?: number | null
          original_guest_estimate?: number | null
          original_quote?: number | null
          stated_budget?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_booked?: string | null
          entered_by?: string | null
          event_id?: string
          id?: string
          lead_source?: string | null
          original_catering_estimate?: number | null
          original_guest_estimate?: number | null
          original_quote?: number | null
          stated_budget?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_details_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      seating_assignments: {
        Row: {
          created_at: string | null
          event_id: string | null
          guest_email: string | null
          guest_id: string | null
          guest_name: string | null
          id: string
          lodging_room_id: string | null
          meal_preference: string | null
          notes: string | null
          seat_number: number | null
          source: string | null
          table_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          guest_email?: string | null
          guest_id?: string | null
          guest_name?: string | null
          id?: string
          lodging_room_id?: string | null
          meal_preference?: string | null
          notes?: string | null
          seat_number?: number | null
          source?: string | null
          table_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          guest_email?: string | null
          guest_id?: string | null
          guest_name?: string | null
          id?: string
          lodging_room_id?: string | null
          meal_preference?: string | null
          notes?: string | null
          seat_number?: number | null
          source?: string | null
          table_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seating_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seating_assignments_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seating_assignments_lodging_room_id_fkey"
            columns: ["lodging_room_id"]
            isOneToOne: false
            referencedRelation: "lodging_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seating_assignments_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "seating_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      seating_config: {
        Row: {
          event_id: string
          layout_image_url: string | null
          seating_mode: string
          table_count: number
          updated_at: string
        }
        Insert: {
          event_id: string
          layout_image_url?: string | null
          seating_mode?: string
          table_count?: number
          updated_at?: string
        }
        Update: {
          event_id?: string
          layout_image_url?: string | null
          seating_mode?: string
          table_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seating_config_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      seating_tables: {
        Row: {
          capacity: number
          color: string
          created_at: string | null
          event_id: string | null
          id: string
          label: string | null
          layout_id: string | null
          seat_count: number
          sort_order: number | null
          table_name: string
          table_number: number | null
          table_type: string | null
        }
        Insert: {
          capacity?: number
          color?: string
          created_at?: string | null
          event_id?: string | null
          id?: string
          label?: string | null
          layout_id?: string | null
          seat_count?: number
          sort_order?: number | null
          table_name: string
          table_number?: number | null
          table_type?: string | null
        }
        Update: {
          capacity?: number
          color?: string
          created_at?: string | null
          event_id?: string | null
          id?: string
          label?: string | null
          layout_id?: string | null
          seat_count?: number
          sort_order?: number | null
          table_name?: string
          table_number?: number | null
          table_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seating_tables_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seating_tables_layout_id_fkey"
            columns: ["layout_id"]
            isOneToOne: false
            referencedRelation: "layout_library"
            referencedColumns: ["id"]
          },
        ]
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
      acquire_stripe_session_lock: {
        Args: { p_booking_id: string }
        Returns: boolean
      }
      can_edit_section: {
        Args: {
          _section: Database["public"]["Enums"]["app_section"]
          _user_id: string
        }
        Returns: boolean
      }
      can_view_section: {
        Args: {
          _section: Database["public"]["Enums"]["app_section"]
          _user_id: string
        }
        Returns: boolean
      }
      cleanup_stale_session_locks: { Args: never; Returns: number }
      ensure_standard_vendor_roles: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_event_member: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      lb_ensure_block_for_event: {
        Args: { _event_id: string }
        Returns: string
      }
      lb_section_name_for_room_type: {
        Args: { _room_type: string }
        Returns: string
      }
      lookup_guest_booking: {
        Args: { p_email: string; p_event_slug: string; p_section_slug: string }
        Returns: {
          addon_amount: number
          addons_selected: Json
          base_amount: number
          booking_id: string
          booking_link_slug: string
          check_in_date: string
          check_out_date: string
          cot_1night_rate: number
          cot_2night_rate: number
          cot_fee: number
          cot_requested: boolean
          couple_names: string
          covered_at: string
          deposit_paid_at: string
          event_id: string
          final_paid_at: string
          guest_email: string
          guest_name: string
          guest_nightly_rate: number
          is_primary: boolean
          nights: number
          payment_schedule: string
          payment_status: string
          resort_fee: number
          resort_fee_percent: number
          section_id: string
          section_name: string
          tax_amount: number
          total_amount: number
          wedding_date: string
          wedding_name: string
        }[]
      }
      lookup_rsvp_event: {
        Args: { p_token: string }
        Returns: {
          event_id: string
          event_title: string
          partner1_name: string
          partner2_name: string
          wedding_date: string
        }[]
      }
      lookup_rsvp_guests: {
        Args: { p_token: string }
        Returns: {
          dietary_restrictions: string[]
          email: string
          first_name: string
          id: string
          is_plus_one: boolean
          last_name: string
          lodging_preference: string
          meal_preference: string
          party_size: number
          plus_one_of: string
          rsvp_lodging_details: Json
          rsvp_responses: Json
          rsvp_status: string
          rsvp_submitted_at: string
        }[]
      }
      lookup_rsvp_meal_events: {
        Args: { p_token: string }
        Returns: {
          id: string
          included_in_package: boolean
          location: string
          meal_type: string
        }[]
      }
      lookup_secondary_guest: {
        Args: { p_email: string; p_event_slug: string }
        Returns: {
          booking_id: string
          guest_name: string
          guest_nightly_rate: number
          nights: number
          payment_status: string
          resort_fee_percent: number
          section_name: string
        }[]
      }
      lookup_tracker_by_token: {
        Args: { p_token: string }
        Returns: {
          bookings: Json
          check_in_date: string
          check_out_date: string
          couple_names: string
          event_id: string
          sections: Json
          wedding_name: string
        }[]
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
      submit_rsvp: {
        Args: { p_guest_id: string; p_payload: Json; p_token: string }
        Returns: undefined
      }
      submit_rsvp_unmatched: {
        Args: {
          p_email: string
          p_first_name: string
          p_last_name: string
          p_payload: Json
          p_token: string
        }
        Returns: string
      }
      user_access_level: {
        Args: {
          _section: Database["public"]["Enums"]["app_section"]
          _user_id: string
        }
        Returns: Database["public"]["Enums"]["access_level"]
      }
    }
    Enums: {
      access_level: "full" | "view" | "none"
      app_section:
        | "event_planning"
        | "vendors_experiences_decor"
        | "our_people"
        | "financials"
        | "sales_roster"
        | "marketing_roster"
        | "preferred_vendors_catalog"
        | "other_catalogs"
        | "settings"
        | "tasting_notes"
        | "gmail_inbox"
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
      access_level: ["full", "view", "none"],
      app_section: [
        "event_planning",
        "vendors_experiences_decor",
        "our_people",
        "financials",
        "sales_roster",
        "marketing_roster",
        "preferred_vendors_catalog",
        "other_catalogs",
        "settings",
        "tasting_notes",
        "gmail_inbox",
      ],
      notification_status: ["pending", "sent", "failed", "permanent_failure"],
    },
  },
} as const
