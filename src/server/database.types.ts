
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_logs": {
                  Row: {
                    "action": string,"actor_kind": string,"actor_user_id": string | null,"changes": Json | null,"created_at": string,"entity": string | null,"entity_id": string | null,"id": number,"ip_hash": string | null,"organization_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_kind": string,"actor_user_id"?: string | null,"changes"?: Json | null,"created_at"?: string,"entity"?: string | null,"entity_id"?: string | null,"id"?: never,"ip_hash"?: string | null,"organization_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_kind"?: string,"actor_user_id"?: string | null,"changes"?: Json | null,"created_at"?: string,"entity"?: string | null,"entity_id"?: string | null,"id"?: never,"ip_hash"?: string | null,"organization_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string,"organization_id": string,"revoked_at": string | null,"role": Database["public"]['Enums']["member_role"],"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"email": string,"expires_at"?: string,"id"?: string,"invited_by": string,"organization_id": string,"revoked_at"?: string | null,"role": Database["public"]['Enums']["member_role"],"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string,"organization_id"?: string,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"id": string,"invited_by": string | null,"organization_id": string,"role": Database["public"]['Enums']["member_role"],"status": Database["public"]['Enums']["member_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"invited_by"?: string | null,"organization_id": string,"role": Database["public"]['Enums']["member_role"],"status"?: Database["public"]['Enums']["member_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"invited_by"?: string | null,"organization_id"?: string,"role"?: Database["public"]['Enums']["member_role"],"status"?: Database["public"]['Enums']["member_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_slug_history": {
                  Row: {
                    "organization_id": string,"replaced_at": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "organization_id": string,"replaced_at"?: string,"slug": string
                  }
                  Update: {
                    "organization_id"?: string,"replaced_at"?: string,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_slug_history_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"name": string,"onboarding": Json | null,"phone": string | null,"segment": Database["public"]['Enums']["org_segment"],"settings": NonNullable<Json>,"slug": string,"status": Database["public"]['Enums']["org_status"],"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"onboarding"?: Json | null,"phone"?: string | null,"segment": Database["public"]['Enums']["org_segment"],"settings"?: NonNullable<Json>,"slug": string,"status"?: Database["public"]['Enums']["org_status"],"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"onboarding"?: Json | null,"phone"?: string | null,"segment"?: Database["public"]['Enums']["org_segment"],"settings"?: NonNullable<Json>,"slug"?: string,"status"?: Database["public"]['Enums']["org_status"],"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"platform_admins": {
                  Row: {
                    "created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"professionals": {
                  Row: {
                    "accepts_public_booking": boolean,"active": boolean,"color": number,"council_number": string | null,"council_type": string | null,"created_at": string,"display_name": string,"id": string,"organization_id": string,"specialty": string | null,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepts_public_booking"?: boolean,"active"?: boolean,"color"?: number,"council_number"?: string | null,"council_type"?: string | null,"created_at"?: string,"display_name": string,"id"?: string,"organization_id": string,"specialty"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "accepts_public_booking"?: boolean,"active"?: boolean,"color"?: number,"council_number"?: string | null,"council_type"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"organization_id"?: string,"specialty"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "professionals_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string,"phone": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name": string,"phone"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string,"phone"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"role_permissions": {
                  Row: {
                    "permission": string,"role": Database["public"]['Enums']["member_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "permission": string,"role": Database["public"]['Enums']["member_role"]
                  }
                  Update: {
                    "permission"?: string,"role"?: Database["public"]['Enums']["member_role"]
                  }
                  Relationships: [
                    
                  ]
                },"units": {
                  Row: {
                    "address": Json | null,"created_at": string,"id": string,"is_default": boolean,"name": string,"organization_id": string,"timezone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: Json | null,"created_at"?: string,"id"?: string,"is_default"?: boolean,"name": string,"organization_id": string,"timezone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: Json | null,"created_at"?: string,"id"?: string,"is_default"?: boolean,"name"?: string,"organization_id"?: string,"timezone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "units_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"appointment_events": {
                  Row: {
                    "actor_user_id": string | null,"appointment_id": string,"created_at": string,"from_status": Database["public"]['Enums']["appointment_status"] | null,"id": number,"organization_id": string,"reason": string | null,"to_status": Database["public"]['Enums']["appointment_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_user_id"?: string | null,"appointment_id": string,"created_at"?: string,"from_status"?: Database["public"]['Enums']["appointment_status"] | null,"id"?: never,"organization_id": string,"reason"?: string | null,"to_status": Database["public"]['Enums']["appointment_status"]
                  }
                  Update: {
                    "actor_user_id"?: string | null,"appointment_id"?: string,"created_at"?: string,"from_status"?: Database["public"]['Enums']["appointment_status"] | null,"id"?: never,"organization_id"?: string,"reason"?: string | null,"to_status"?: Database["public"]['Enums']["appointment_status"]
                  }
                  Relationships: [

                  ]
                },"appointments": {
                  Row: {
                    "admin_notes": string | null,"created_at": string,"created_by": string | null,"ends_at": string,"hold_expires_at": string | null,"id": string,"organization_id": string,"origin": Database["public"]['Enums']["appointment_origin"],"patient_id": string | null,"professional_id": string,"service_id": string,"starts_at": string,"status": Database["public"]['Enums']["appointment_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_notes"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_at": string,"hold_expires_at"?: string | null,"id"?: string,"organization_id": string,"origin"?: Database["public"]['Enums']["appointment_origin"],"patient_id"?: string | null,"professional_id": string,"service_id": string,"starts_at": string,"status": Database["public"]['Enums']["appointment_status"],"updated_at"?: string
                  }
                  Update: {
                    "admin_notes"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string,"hold_expires_at"?: string | null,"id"?: string,"organization_id"?: string,"origin"?: Database["public"]['Enums']["appointment_origin"],"patient_id"?: string | null,"professional_id"?: string,"service_id"?: string,"starts_at"?: string,"status"?: Database["public"]['Enums']["appointment_status"],"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"availability_rules": {
                  Row: {
                    "created_at": string,"end_time": string,"id": string,"organization_id": string,"professional_id": string,"start_time": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"end_time": string,"id"?: string,"organization_id": string,"professional_id": string,"start_time": string,"weekday": number
                  }
                  Update: {
                    "created_at"?: string,"end_time"?: string,"id"?: string,"organization_id"?: string,"professional_id"?: string,"start_time"?: string,"weekday"?: number
                  }
                  Relationships: [

                  ]
                },"patients": {
                  Row: {
                    "admin_notes": string | null,"birth_date": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"email": string | null,"full_name": string,"id": string,"organization_id": string,"phone_e164": string | null,"source": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_notes"?: string | null,"birth_date"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"email"?: string | null,"full_name": string,"id"?: string,"organization_id": string,"phone_e164"?: string | null,"source"?: string,"updated_at"?: string
                  }
                  Update: {
                    "admin_notes"?: string | null,"birth_date"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"email"?: string | null,"full_name"?: string,"id"?: string,"organization_id"?: string,"phone_e164"?: string | null,"source"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"professional_services": {
                  Row: {
                    "organization_id": string,"professional_id": string,"service_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "organization_id": string,"professional_id": string,"service_id": string
                  }
                  Update: {
                    "organization_id"?: string,"professional_id"?: string,"service_id"?: string
                  }
                  Relationships: [

                  ]
                },"schedule_blocks": {
                  Row: {
                    "created_at": string,"created_by": string | null,"ends_at": string,"id": string,"kind": Database["public"]['Enums']["block_kind"],"organization_id": string,"professional_id": string | null,"reason": string | null,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"ends_at": string,"id"?: string,"kind": Database["public"]['Enums']["block_kind"],"organization_id": string,"professional_id"?: string | null,"reason"?: string | null,"starts_at": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"ends_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["block_kind"],"organization_id"?: string,"professional_id"?: string | null,"reason"?: string | null,"starts_at"?: string
                  }
                  Relationships: [

                  ]
                },"services": {
                  Row: {
                    "active": boolean,"buffer_after_min": number,"category": string | null,"created_at": string,"duration_min": number,"id": string,"is_public": boolean,"name": string,"organization_id": string,"price_cents": number | null,"show_price_publicly": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"buffer_after_min"?: number,"category"?: string | null,"created_at"?: string,"duration_min": number,"id"?: string,"is_public"?: boolean,"name": string,"organization_id": string,"price_cents"?: number | null,"show_price_publicly"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"buffer_after_min"?: number,"category"?: string | null,"created_at"?: string,"duration_min"?: number,"id"?: string,"is_public"?: boolean,"name"?: string,"organization_id"?: string,"price_cents"?: number | null,"show_price_publicly"?: boolean,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"change_member_role":
{ Args: { "p_membership": string,"p_role": Database["public"]['Enums']["member_role"] }; Returns: undefined
                           },
"change_slug":
{ Args: { "p_org": string,"p_slug": string }; Returns: undefined
                           },
"create_invitation":
{ Args: { "p_email": string,"p_org": string,"p_role": Database["public"]['Enums']["member_role"] }; Returns: string
                           },
"create_organization":
{ Args: { "p_attends"?: boolean,"p_name": string,"p_onboarding"?: Json,"p_segment": Database["public"]['Enums']["org_segment"],"p_slug": string,"p_specialty"?: string,"p_timezone"?: string }; Returns: string
                           },
"get_my_invitation":
{ Args: { "p_token": string }; Returns: {
              "expires_at": string,"invited_by_name": string,"needs_password": boolean,"organization_name": string,"role": Database["public"]['Enums']["member_role"]
            }[]
                           },
"invitation_email_for_token":
{ Args: { "p_token": string }; Returns: string
                           },
"list_team":
{ Args: { "p_org": string }; Returns: {
              "email": string,"full_name": string,"is_professional": boolean,"joined_at": string,"membership_id": string,"role": Database["public"]['Enums']["member_role"],"status": Database["public"]['Enums']["member_status"],"user_id": string
            }[]
                           },
"revoke_invitation":
{ Args: { "p_invitation": string }; Returns: undefined
                           },
"set_member_status":
{ Args: { "p_membership": string,"p_status": Database["public"]['Enums']["member_status"] }; Returns: undefined
                           },
"slug_available":
{ Args: { "p_slug": string }; Returns: boolean
                           },
"create_appointment":
{ Args: { "p_notes"?: string,"p_org": string,"p_patient": string,"p_professional": string,"p_service": string,"p_starts_at": string }; Returns: string
                           },
"delete_patient":
{ Args: { "p_id": string }; Returns: undefined
                           },
"reschedule_appointment":
{ Args: { "p_id": string,"p_professional"?: string,"p_starts_at": string }; Returns: undefined
                           },
"schedule_busy":
{ Args: { "p_from": string,"p_org": string,"p_to": string }; Returns: {
              "ends_at": string,"id": string,"professional_id": string,"starts_at": string,"status": Database["public"]['Enums']["appointment_status"]
            }[]
                           },
"set_appointment_status":
{ Args: { "p_id": string,"p_reason"?: string,"p_to": Database["public"]['Enums']["appointment_status"] }; Returns: undefined
                           },
"set_weekly_availability":
{ Args: { "p_professional": string,"p_rules": Json }; Returns: undefined
                           }
          }
          Enums: {
            "appointment_origin": "staff"|"public"|"import"|"integration","appointment_status": "requested"|"confirmed"|"declined"|"expired"|"cancelled"|"no_show"|"completed","block_kind": "break"|"time_off"|"vacation"|"holiday"|"other","member_role": "manager"|"reception"|"professional","member_status": "invited"|"active"|"disabled","org_segment": "medical_clinic"|"medical_office"|"dental_clinic"|"dental_office"|"aesthetic_clinic"|"aesthetic_office"|"multidisciplinary"|"other","org_status": "trial"|"active"|"suspended"|"cancelled"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "appointment_origin": ["staff", "public", "import", "integration"],"appointment_status": ["requested", "confirmed", "declined", "expired", "cancelled", "no_show", "completed"],"block_kind": ["break", "time_off", "vacation", "holiday", "other"],"member_role": ["manager", "reception", "professional"],"member_status": ["invited", "active", "disabled"],"org_segment": ["medical_clinic", "medical_office", "dental_clinic", "dental_office", "aesthetic_clinic", "aesthetic_office", "multidisciplinary", "other"],"org_status": ["trial", "active", "suspended", "cancelled"]
          }
        }
} as const
