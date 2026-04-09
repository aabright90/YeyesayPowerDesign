# frozen_string_literal: true

# ─── REFERENCE IMPLEMENTATION ────────────────────────────────────────────────
# This file lives in the Next.js repo purely for reference.
# Copy it into the actual Rails backend at:
#   app/controllers/api/v1/users_controller.rb
# ─────────────────────────────────────────────────────────────────────────────
#
# PREREQUISITE (run in Rails console or migration):
#
#   rails active_storage:install
#   rails db:migrate
#
# Then in app/models/user.rb:
#
#   class User < ApplicationRecord
#     has_one_attached :avatar_mesh
#   end
#
# And in config/routes.rb:
#
#   namespace :api do
#     namespace :v1 do
#       patch 'users/update_mesh', to: 'users#update_mesh'
#     end
#   end
# ─────────────────────────────────────────────────────────────────────────────

module Api
  module V1
    class UsersController < ApplicationController
      # ── Authentication ────────────────────────────────────────────────────
      #
      # before_action runs BEFORE the controller method executes.
      # It's the Rails equivalent of Next.js middleware — any request that
      # reaches update_mesh has already passed through authenticate_user!.
      #
      # Devise + devise-jwt gives us:
      #   • authenticate_user!  → halts with 401 if no valid JWT
      #   • current_user        → the User record decoded from the token
      #
      before_action :authenticate_user!

      # PATCH /api/v1/users/update_mesh
      #
      # Receives a multipart/form-data request with the .glb file.
      #
      # CRITICAL: The frontend sends FormData (not JSON). Rails automatically
      # parses multipart bodies — the file lands in params[:avatar_mesh] as
      # an ActionDispatch::Http::UploadedFile object with:
      #   • .original_filename  → "body_scan.glb"
      #   • .content_type       → "model/gltf-binary"
      #   • .tempfile            → the actual file on disk
      #
      # Active Storage's .attach() takes that UploadedFile directly — no
      # manual file handling needed. Under the hood, Active Storage:
      #   1. Computes a checksum of the file
      #   2. Uploads it to the configured storage service (local disk, S3, GCS)
      #   3. Creates an ActiveStorage::Blob record in the DB
      #   4. Creates an ActiveStorage::Attachment joining User → Blob
      #   5. If there was a previous avatar_mesh, it's automatically purged
      #
      def update_mesh
        unless params[:avatar_mesh].present?
          return render json: { error: "No mesh file provided" }, status: :unprocessable_entity
        end

        # .attach() replaces any previously attached file (has_one_attached)
        current_user.avatar_mesh.attach(params[:avatar_mesh])

        if current_user.avatar_mesh.attached?
          mesh_url = Rails.application.routes.url_helpers.rails_blob_url(
            current_user.avatar_mesh,
            only_path: true
          )

          render json: { mesh_url: mesh_url }, status: :ok
        else
          render json: { error: "Failed to attach mesh" }, status: :unprocessable_entity
        end
      end
    end
  end
end

# ─── EXAM CHEAT SHEET: Active Storage Key Concepts ──────────────────────────
#
# 1. ASSOCIATIONS
#    has_one_attached  :avatar      → single file (profile pic, 3D scan)
#    has_many_attached :photos      → multiple files (gallery, portfolio)
#
# 2. ATTACHING FILES
#    user.avatar.attach(params[:avatar])           → from form upload
#    user.avatar.attach(io: File.open('/path'),     → from local file
#                       filename: 'scan.glb',
#                       content_type: 'model/gltf-binary')
#
# 3. QUERYING
#    user.avatar.attached?            → boolean
#    user.avatar.filename             → "scan.glb"
#    user.avatar.content_type         → "model/gltf-binary"
#    user.avatar.byte_size            → 2_456_789
#    user.avatar.created_at           → timestamp
#
# 4. URLS
#    rails_blob_url(user.avatar)              → full URL with host
#    rails_blob_url(user.avatar, only_path: true) → relative path
#    rails_blob_path(user.avatar)             → alias for only_path
#
# 5. PURGING (deleting)
#    user.avatar.purge          → deletes blob + file synchronously
#    user.avatar.purge_later    → deletes via background job (Active Job)
#
# 6. VARIANTS (image manipulation — not relevant for .glb but good to know)
#    user.avatar.variant(resize_to_limit: [100, 100])
#
# 7. STRONG PARAMS — files don't need permit() in the same way:
#    params[:avatar_mesh] already works because multipart file params
#    are ActionDispatch::Http::UploadedFile objects, not nested hashes.
#    But if you're using require().permit(), you'd do:
#      params.permit(:avatar_mesh)
#
# 8. STORAGE SERVICES (config/storage.yml)
#    development → :local (disk)
#    production  → :amazon (S3), :google (GCS), :microsoft (Azure)
#
# 9. before_action FILTER CHAIN
#    Runs top-to-bottom. If authenticate_user! halts (renders 401),
#    update_mesh never executes. You can scope filters:
#      before_action :set_user, only: [:show, :update]
#      before_action :admin_only, except: [:index]
#
# 10. RENDER AND RETURN
#     In Rails controllers, `render` doesn't stop execution — code after
#     it still runs. To early-return, use `return render json: ...` or
#     `render ... and return`. Double-render causes AbstractController::
#     DoubleRenderError.
# ────────────────────────────────────────────────────────────────────────────
