# frozen_string_literal: true

# ─── USER MODEL ──────────────────────────────────────────────────────────────
#
# CRASH COURSE — ACTIVE RECORD MODEL PATTERNS:
#
# • Models live in app/models/ — they inherit from ApplicationRecord
# • Associations: has_many, belongs_to, has_one, has_and_belongs_to_many
# • Active Storage: has_one_attached, has_many_attached for file uploads
# • Validations: validates :field, presence: true, length: { in: 1..50 }
# • Callbacks: before_save, after_create, etc.
# • Scopes: scope :completed, -> { where.not(onboarding_completed_at: nil) }
# • Enums: enum status: { active: 0, inactive: 1 }

class User < ApplicationRecord
  # ── Devise authentication ─────────────────────────────────────────────────
  # Include default devise modules — adjust as needed for your app
  devise :database_authenticatable, :registerable, :recoverable, 
         :rememberable, :validatable, :jwt_authenticatable, 
         jwt_revocation_strategy: JwtDenylist

  # ── Active Storage attachments ────────────────────────────────────────────
  # Face photo for onboarding step 2
  has_one_attached :face_photo
  
  # 3D avatar mesh (optional GLB upload) 
  has_one_attached :avatar_mesh

  # ── Associations ──────────────────────────────────────────────────────────
  has_many :garments, dependent: :destroy

  # ── Validations ───────────────────────────────────────────────────────────
  validates :display_name, length: { maximum: 100 }
  validates :phone, format: { with: /\A[\d\s\-\+\(\)\.]+\z/, message: "invalid format" }, 
                   allow_blank: true
  validates :bio, length: { maximum: 500 }
  
  # Pose vibe must be from allowed list (for 3D presets + Fal prompts)
  validates :pose_vibe, inclusion: { 
    in: %w[elegant sassy sexy casual power playful],
    message: "%{value} is not a valid pose vibe"
  }, allow_blank: true

  validates :pose_notes, length: { maximum: 200 }

  # ── JSONB body_profile validation ─────────────────────────────────────────
  # If using jsonb approach, validate the structure
  validate :validate_body_profile_structure

  # ── Scopes ────────────────────────────────────────────────────────────────
  # Admin queries
  scope :onboarding_complete, -> { where.not(onboarding_completed_at: nil) }
  scope :onboarding_incomplete, -> { where(onboarding_completed_at: nil) }
  scope :with_face_photo, -> { joins(:face_photo_attachment) }
  scope :by_pose_vibe, ->(vibe) { where(pose_vibe: vibe) }

  # ── Instance methods ──────────────────────────────────────────────────────
  
  def onboarding_complete?
    onboarding_completed_at.present?
  end

  def face_photo_url
    return nil unless face_photo.attached?
    Rails.application.routes.url_helpers.rails_blob_url(face_photo)
  end

  def avatar_mesh_url
    return nil unless avatar_mesh.attached?
    Rails.application.routes.url_helpers.rails_blob_url(avatar_mesh)
  end

  # Extract measurements from jsonb or individual columns
  def measurements
    if body_profile.present?
      {
        height: body_profile['height'] || body_profile['height_cm'],
        chest: body_profile['chest'] || body_profile['bust_cm'],
        waist: body_profile['waist'] || body_profile['waist_cm'],
        hips: body_profile['hips'] || body_profile['hip_cm'],
        unit: body_profile['unit'] || 'imperial',
        size_preset: body_profile['size_preset']
      }
    else
      # Fallback to individual columns if using Option B from migration
      {
        height: height_cm,
        chest: bust_cm, 
        waist: waist_cm,
        hips: hip_cm,
        unit: unit,
        size_preset: size_preset
      }
    end
  end

  def update_measurements!(measurement_data)
    if column_names.include?('body_profile')
      # Using jsonb approach
      update!(body_profile: body_profile.merge(measurement_data))
    else
      # Using individual columns
      update!(measurement_data.slice(:height_cm, :bust_cm, :waist_cm, :hip_cm, :unit, :size_preset))
    end
  end

  def complete_onboarding!
    update!(onboarding_completed_at: Time.current)
  end

  # Check if user has minimum required fields for onboarding completion
  def ready_for_completion?
    display_name.present? && 
    face_photo.attached? && 
    (body_profile.present? || measurements.values.any?(&:present?))
  end

  private

  def validate_body_profile_structure
    return unless body_profile.present?
    
    allowed_keys = %w[height height_cm chest bust_cm waist waist_cm hips hip_cm unit size_preset]
    invalid_keys = body_profile.keys - allowed_keys
    
    if invalid_keys.any?
      errors.add(:body_profile, "contains invalid keys: #{invalid_keys.join(', ')}")
    end

    # Validate numeric values
    %w[height height_cm chest bust_cm waist waist_cm hips hip_cm].each do |key|
      value = body_profile[key]
      next unless value.present?
      
      unless value.is_a?(Numeric) && value > 0
        errors.add(:body_profile, "#{key} must be a positive number")
      end
    end

    # Validate unit
    unit = body_profile['unit']
    if unit.present? && !%w[imperial metric].include?(unit)
      errors.add(:body_profile, "unit must be 'imperial' or 'metric'")
    end
  end
end