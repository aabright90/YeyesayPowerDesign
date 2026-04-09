# frozen_string_literal: true

# ─── ADD ADMIN FIELDS TO GARMENTS ─────────────────────────────────────────────
#
# Migration: Extends garments table with rich metadata for admin visibility
# 
# ADMIN NEEDS: "Get the best idea of what they have to work with"
# • Condition assessment (new, good, worn, damaged)
# • Detailed fabric descriptions 
# • Brand/designer info
# • Notes for tailors/seamsters
# • Source tracking (store inventory vs client uploads)

class AddAdminFieldsToGarments < ActiveRecord::Migration[7.0]
  def change
    # ── Condition & quality assessment ───────────────────────────────────────
    add_column :garments, :condition, :string
    add_column :garments, :condition_notes, :text
    
    # ── Fabric & material details ────────────────────────────────────────────
    add_column :garments, :fabric_description, :text
    add_column :garments, :fabric_composition, :string  # "100% Cotton", "80% Wool, 20% Poly"
    add_column :garments, :fabric_weight, :string       # "Lightweight", "Medium", "Heavy"
    add_column :garments, :stretch_factor, :string      # "No stretch", "Slight", "High stretch"
    
    # ── Brand & designer info ─────────────────────────────────────────────────
    add_column :garments, :brand, :string
    add_column :garments, :designer, :string
    add_column :garments, :original_price, :decimal, precision: 8, scale: 2
    add_column :garments, :estimated_value, :decimal, precision: 8, scale: 2
    
    # ── Care & maintenance ────────────────────────────────────────────────────
    add_column :garments, :care_instructions, :text
    add_column :garments, :dry_clean_only, :boolean, default: false
    
    # ── Tailoring & alteration notes ─────────────────────────────────────────
    add_column :garments, :notes_for_tailor, :text
    add_column :garments, :alteration_history, :text
    add_column :garments, :recommended_alterations, :text
    
    # ── Source & inventory tracking ──────────────────────────────────────────
    add_column :garments, :source, :string  # 'store', 'client_upload', 'donation', 'estate_sale'
    add_column :garments, :acquired_date, :date
    add_column :garments, :acquisition_cost, :decimal, precision: 8, scale: 2
    add_column :garments, :location, :string  # Physical storage location
    add_column :garments, :sku, :string      # Stock Keeping Unit for inventory
    
    # ── Client interaction fields ────────────────────────────────────────────
    add_column :garments, :client_notes, :text     # What the client said about it
    add_column :garments, :sentimental_value, :text  # Family heirloom, gift, etc.
    
    # ── Processing status ─────────────────────────────────────────────────────
    add_column :garments, :intake_status, :string, default: 'received'
    add_column :garments, :processed_at, :datetime
    add_column :garments, :processed_by, :string   # Staff member who processed it
    
    # ── Indexes for admin queries ────────────────────────────────────────────
    add_index :garments, :condition
    add_index :garments, :brand
    add_index :garments, :source
    add_index :garments, :intake_status
    add_index :garments, :sku, unique: true
    add_index :garments, :acquired_date
  end
end