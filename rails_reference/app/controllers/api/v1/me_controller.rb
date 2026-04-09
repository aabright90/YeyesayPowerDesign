# frozen_string_literal: true

# ─── ME CONTROLLER ────────────────────────────────────────────────────────────
#
# CRASH COURSE — RAILS API CONTROLLER PATTERNS:
#
# • Controllers live in app/controllers/ — inherit from ApplicationController
# • before_action runs before specified actions (authentication, loading)
# • Strong params: params.require(:user).permit(:name, :email) — security
# • render json: data — returns JSON response
# • HTTP status codes: :ok (200), :created (201), :unprocessable_entity (422)
# • Active Storage URLs: rails_blob_url(attachment, only_path: false)
# • Error handling: rescue_from for global error catching

module Api
  module V1
    class MeController < ApplicationController
      # ── Authentication ────────────────────────────────────────────────────────
      # Ensure user is authenticated before any action
      before_action :authenticate_user!

      # ── Actions ───────────────────────────────────────────────────────────────

      # GET /api/v1/me
      # Returns current user profile + onboarding status + attachment URLs
      def show
        render json: {
          id: current_user.id,
          email: current_user.email,
          display_name: current_user.display_name,
          phone: current_user.phone,
          bio: current_user.bio,
          onboarding_completed_at: current_user.onboarding_completed_at,
          onboarding_complete: current_user.onboarding_complete?,
          
          # Measurements (from jsonb or individual columns)
          measurements: current_user.measurements,
          
          # Pose preferences
          pose_vibe: current_user.pose_vibe,
          pose_notes: current_user.pose_notes,
          
          # Attachment URLs (full URLs for client consumption)
          face_photo_url: current_user.face_photo_url,
          avatar_mesh_url: current_user.avatar_mesh_url,
          
          # Metadata
          created_at: current_user.created_at,
          updated_at: current_user.updated_at
        }
      end

      # PATCH /api/v1/me
      # Updates user profile, measurements, pose preferences
      def update
        if current_user.update(profile_params)
          render json: {
            message: "Profile updated successfully",
            user: {
              id: current_user.id,
              display_name: current_user.display_name,
              measurements: current_user.measurements,
              pose_vibe: current_user.pose_vibe,
              onboarding_complete: current_user.onboarding_complete?
            }
          }
        else
          render json: {
            error: "Failed to update profile",
            errors: current_user.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/me/face_photo
      # Uploads face photo via multipart/form-data
      def update_face_photo
        unless params[:face_photo].present?
          return render json: { 
            error: "No face photo provided" 
          }, status: :unprocessable_entity
        end

        # Active Storage attachment — Rails handles multipart parsing
        current_user.face_photo.attach(params[:face_photo])

        if current_user.face_photo.attached?
          render json: {
            message: "Face photo uploaded successfully",
            face_photo_url: current_user.face_photo_url
          }
        else
          render json: {
            error: "Failed to attach face photo"
          }, status: :unprocessable_entity
        end
      rescue StandardError => e
        render json: {
          error: "Face photo upload failed: #{e.message}"
        }, status: :internal_server_error
      end

      # POST /api/v1/me/complete_onboarding
      # Validates required fields and marks onboarding complete
      def complete_onboarding
        unless current_user.ready_for_completion?
          missing_fields = []
          missing_fields << "display_name" unless current_user.display_name.present?
          missing_fields << "face_photo" unless current_user.face_photo.attached?
          missing_fields << "measurements" unless current_user.measurements.values.any?(&:present?)

          return render json: {
            error: "Onboarding requirements not met",
            missing_fields: missing_fields,
            requirements: {
              display_name: "Display name is required",
              face_photo: "Face photo must be uploaded", 
              measurements: "At least one measurement must be provided"
            }
          }, status: :unprocessable_entity
        end

        current_user.complete_onboarding!
        
        render json: {
          message: "Onboarding completed successfully",
          onboarding_completed_at: current_user.onboarding_completed_at,
          redirect_to: "/studio"
        }
      rescue StandardError => e
        render json: {
          error: "Failed to complete onboarding: #{e.message}"
        }, status: :internal_server_error
      end

      private

      # ── Strong Parameters ─────────────────────────────────────────────────────
      # SECURITY: Only allow specific parameters to prevent mass assignment
      # This is a CRITICAL Rails security pattern for interviews
      
      def profile_params
        params.require(:user).permit(
          :display_name,
          :phone, 
          :bio,
          :pose_vibe,
          :pose_notes,
          body_profile: {},  # Allow any keys in jsonb hash
          # If using individual columns instead of jsonb:
          # :height_cm, :bust_cm, :waist_cm, :hip_cm, :unit, :size_preset
        )
      end

      # Alternative: separate params method for measurements only
      def measurement_params
        params.permit(
          :height, :chest, :waist, :hips, :unit, :size_preset,
          body_profile: {}
        )
      end
    end
  end
end