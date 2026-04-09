# frozen_string_literal: true

# ─── GARMENT MODEL ────────────────────────────────────────────────────────────
#
# Extended with rich admin metadata for tailor/seamster visibility
# Balances client upload simplicity with admin information needs

class Garment < ApplicationRecord
  # ── Associations ──────────────────────────────────────────────────────────
  belongs_to :user
  
  # ── Active Storage ────────────────────────────────────────────────────────
  has_one_attached :image
  has_many_attached :detail_photos  # Additional angles, close-ups, etc.

  # ── Validations ───────────────────────────────────────────────────────────
  validates :name, presence: true, length: { maximum: 200 }
  validates :garment_type, presence: true
  validates :tag, length: { maximum: 100 }
  
  # Admin fields validations
  validates :condition, inclusion: { 
    in: %w[new excellent good fair worn damaged],
    message: "%{value} is not a valid condition"
  }, allow_blank: true

  validates :source, inclusion: { 
    in: %w[store client_upload donation estate_sale vintage_market other],
    message: "%{value} is not a valid source"
  }, allow_blank: true

  validates :intake_status, inclusion: { 
    in: %w[received processing catalogued available reserved sold donated],
    message: "%{value} is not a valid intake status"
  }

  validates :fabric_weight, inclusion: { 
    in: %w[ultralight lightweight medium heavy superheavy],
    message: "%{value} is not a valid fabric weight"
  }, allow_blank: true

  validates :stretch_factor, inclusion: { 
    in: ['no_stretch', 'slight_stretch', 'moderate_stretch', 'high_stretch'],
    message: "%{value} is not a valid stretch factor"
  }, allow_blank: true

  # Price validations
  validates :original_price, :estimated_value, :acquisition_cost,
            numericality: { greater_than_or_equal_to: 0 }, allow_blank: true

  validates :sku, uniqueness: true, allow_blank: true
  validates :location, length: { maximum: 100 }
  validates :processed_by, length: { maximum: 100 }

  # Text field limits
  validates :fabric_description, :notes_for_tailor, :alteration_history,
            :recommended_alterations, :client_notes, :sentimental_value,
            :care_instructions, :condition_notes,
            length: { maximum: 1000 }

  # ── Scopes ────────────────────────────────────────────────────────────────
  
  # Admin filtering
  scope :by_condition, ->(condition) { where(condition: condition) }
  scope :by_source, ->(source) { where(source: source) }
  scope :by_status, ->(status) { where(intake_status: status) }
  scope :by_brand, ->(brand) { where(brand: brand) }
  scope :needs_processing, -> { where(intake_status: ['received', 'processing']) }
  scope :available, -> { where(intake_status: 'available') }
  
  # Client views
  scope :store_inventory, -> { where(source: 'store') }
  scope :client_uploads, -> { where(source: 'client_upload') }

  # Date ranges
  scope :acquired_between, ->(start_date, end_date) { 
    where(acquired_date: start_date..end_date) 
  }
  scope :processed_this_week, -> { 
    where(processed_at: 1.week.ago..Time.current) 
  }

  # ── Class methods ─────────────────────────────────────────────────────────

  def self.condition_options
    %w[new excellent good fair worn damaged]
  end

  def self.source_options  
    %w[store client_upload donation estate_sale vintage_market other]
  end

  def self.intake_status_options
    %w[received processing catalogued available reserved sold donated]
  end

  def self.fabric_weight_options
    %w[ultralight lightweight medium heavy superheavy]
  end

  def self.stretch_factor_options
    %w[no_stretch slight_stretch moderate_stretch high_stretch]
  end

  def self.generate_sku
    # Generate unique SKU: "GAR" + timestamp + random
    "GAR#{Time.current.strftime('%y%m%d')}#{SecureRandom.hex(3).upcase}"
  end

  # ── Instance methods ──────────────────────────────────────────────────────

  def image_url
    return nil unless image.attached?
    Rails.application.routes.url_helpers.rails_blob_url(image)
  end

  def detail_photo_urls
    return [] unless detail_photos.attached?
    detail_photos.map do |photo|
      Rails.application.routes.url_helpers.rails_blob_url(photo)
    end
  end

  def condition_badge_color
    case condition
    when 'new', 'excellent' then 'green'
    when 'good' then 'blue'
    when 'fair' then 'yellow'
    when 'worn' then 'orange'
    when 'damaged' then 'red'
    else 'gray'
    end
  end

  def needs_attention?
    condition.in?(['damaged', 'worn']) || 
    intake_status.in?(['received', 'processing']) ||
    recommended_alterations.present?
  end

  def estimated_profit_margin
    return nil unless original_price.present? && acquisition_cost.present?
    return nil if acquisition_cost.zero?
    
    ((original_price - acquisition_cost) / acquisition_cost * 100).round(2)
  end

  def processing_time
    return nil unless processed_at.present?
    return nil if created_at.blank?
    
    (processed_at - created_at) / 1.day
  end

  def mark_as_processed!(staff_member = nil)
    update!(
      intake_status: 'catalogued',
      processed_at: Time.current,
      processed_by: staff_member
    )
  end

  def assign_sku!
    return if sku.present?
    
    loop do
      new_sku = self.class.generate_sku
      break update!(sku: new_sku) unless Garment.exists?(sku: new_sku)
    end
  end

  # Admin summary for dashboard
  def admin_summary
    {
      id: id,
      name: name,
      condition: condition,
      brand: brand,
      source: source,
      intake_status: intake_status,
      sku: sku,
      needs_attention: needs_attention?,
      has_notes: notes_for_tailor.present?,
      estimated_value: estimated_value,
      processed: processed_at.present?
    }
  end

  # Client-safe summary (hides admin fields)
  def client_summary
    {
      id: id,
      name: name,
      garment_type: garment_type,
      tag: tag,
      image_url: image_url,
      fabric_description: fabric_description&.truncate(200),
      brand: brand,
      care_instructions: care_instructions
    }
  end
end