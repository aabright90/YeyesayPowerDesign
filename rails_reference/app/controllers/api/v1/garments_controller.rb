# frozen_string_literal: true

# ─── GARMENTS CONTROLLER ──────────────────────────────────────────────────────
#
# CRASH COURSE — RESTful Controller Patterns:
#
# • RESTful actions: index (list), show (get one), create, update, destroy
# • before_action for loading records: @garment = current_user.garments.find(params[:id])
# • Strong params prevent mass assignment attacks — CRITICAL for interviews
# • JSON responses with status codes
# • Error handling with try-catch patterns

module Api
  module V1
    class GarmentsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_garment, only: [:show, :update, :destroy]

      # GET /api/v1/garments
      # Lists user's garments + store inventory (depending on access level)
      def index
        @garments = if params[:source] == 'store'
                      # Store inventory - available to all users
                      Garment.store_inventory.available
                    else
                      # User's personal garments
                      current_user.garments
                    end

        # Apply filters
        @garments = @garments.by_condition(params[:condition]) if params[:condition].present?
        @garments = @garments.by_status(params[:status]) if params[:status].present?
        
        # Admin vs client view
        garment_data = if admin_user?
                         @garments.map(&:admin_summary)
                       else
                         @garments.map(&:client_summary)
                       end

        render json: {
          garments: garment_data,
          total_count: @garments.count,
          filters_applied: {
            source: params[:source],
            condition: params[:condition],
            status: params[:status]
          }
        }
      end

      # GET /api/v1/garments/:id
      def show
        garment_data = if admin_user?
                         @garment.attributes.merge(
                           image_url: @garment.image_url,
                           detail_photo_urls: @garment.detail_photo_urls,
                           admin_summary: @garment.admin_summary
                         )
                       else
                         @garment.client_summary
                       end

        render json: { garment: garment_data }
      end

      # POST /api/v1/garments
      # Creates new garment (client upload or admin intake)
      def create
        @garment = current_user.garments.build(garment_params)
        
        # Auto-assign SKU if admin is creating
        @garment.assign_sku! if admin_user?
        
        # Set defaults based on user role
        @garment.source ||= admin_user? ? 'store' : 'client_upload'
        @garment.intake_status ||= 'received'
        @garment.acquired_date ||= Date.current

        if @garment.save
          render json: {
            message: 'Garment created successfully',
            garment: admin_user? ? @garment.admin_summary : @garment.client_summary,
            id: @garment.id
          }, status: :created
        else
          render json: {
            error: 'Failed to create garment',
            errors: @garment.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/garments/:id
      # Updates garment (admin can update all fields, users limited)
      def update
        update_params = admin_user? ? admin_garment_params : client_garment_params

        if @garment.update(update_params)
          render json: {
            message: 'Garment updated successfully',
            garment: admin_user? ? @garment.admin_summary : @garment.client_summary
          }
        else
          render json: {
            error: 'Failed to update garment',
            errors: @garment.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/garments/:id
      def destroy
        if @garment.destroy
          render json: { message: 'Garment deleted successfully' }
        else
          render json: { 
            error: 'Failed to delete garment' 
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/garments/:id/process
      # Admin action: mark garment as processed
      def process
        return render_admin_required unless admin_user?

        @garment = Garment.find(params[:id])
        @garment.mark_as_processed!(current_user.display_name || current_user.email)

        render json: {
          message: 'Garment marked as processed',
          garment: @garment.admin_summary
        }
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Garment not found' }, status: :not_found
      end

      private

      def set_garment
        @garment = if admin_user?
                     # Admin can access any garment
                     Garment.find(params[:id])
                   else
                     # Users can only access their own garments + store inventory
                     accessible_garments.find(params[:id])
                   end
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Garment not found' }, status: :not_found
      end

      def accessible_garments
        # Users can see their own garments + store inventory
        Garment.where(
          'user_id = ? OR source = ?', 
          current_user.id, 
          'store'
        )
      end

      # ── Strong Parameters ─────────────────────────────────────────────────────
      
      # Basic params for client uploads
      def garment_params
        params.require(:garment).permit(
          :name, :garment_type, :tag, :image,
          # Client can provide basic info
          :fabric_description, :brand, :care_instructions,
          :client_notes, :sentimental_value
        )
      end

      # Full admin params for detailed intake
      def admin_garment_params
        params.require(:garment).permit(
          # Basic fields
          :name, :garment_type, :tag, :image,
          
          # Condition & quality
          :condition, :condition_notes,
          
          # Fabric details  
          :fabric_description, :fabric_composition, :fabric_weight, :stretch_factor,
          
          # Brand & pricing
          :brand, :designer, :original_price, :estimated_value,
          
          # Care
          :care_instructions, :dry_clean_only,
          
          # Tailoring notes
          :notes_for_tailor, :alteration_history, :recommended_alterations,
          
          # Inventory tracking
          :source, :acquired_date, :acquisition_cost, :location, :sku,
          
          # Client info
          :client_notes, :sentimental_value,
          
          # Processing
          :intake_status, :processed_by,
          
          # Multiple detail photos
          detail_photos: []
        )
      end

      # Limited params for client updates
      def client_garment_params
        params.require(:garment).permit(
          :name, :fabric_description, :care_instructions,
          :client_notes, :sentimental_value
        )
      end

      # ── Authorization helpers ─────────────────────────────────────────────────

      def admin_user?
        # Adjust this based on your admin role system
        # Could be: current_user.admin? || current_user.role == 'admin'
        current_user.email.ends_with?('@oops.com') || 
        current_user.admin? ||
        false # Default: no admin access
      end

      def render_admin_required
        render json: { 
          error: 'Admin access required' 
        }, status: :forbidden
      end
    end
  end
end