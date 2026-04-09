# frozen_string_literal: true

# ─── ADD ONBOARDING FIELDS TO USERS ──────────────────────────────────────────
#
# Migration: Adds profile, measurements, and onboarding tracking to User model
# 
# CRASH COURSE — RAILS MIGRATIONS:
#
# • Migrations are versioned schema changes — each file has a timestamp prefix
# • `rails generate migration AddOnboardingFieldsToUsers` creates the file
# • `add_column :table, :column_name, :type, options`
# • `t.jsonb` creates a JSON column (Postgres) — flexible but harder to query
# • `null: false` requires the field; `default: value` sets initial value
# • `add_index` creates DB indexes for faster queries
# • Run with: `rails db:migrate`
# • Rollback with: `rails db:rollback`

class AddOnboardingFieldsToUsers < ActiveRecord::Migration[7.0]
  def change
    # ── Profile basics ────────────────────────────────────────────────────────
    add_column :users, :display_name, :string
    add_column :users, :phone, :string
    add_column :users, :bio, :text

    # ── Onboarding tracking ───────────────────────────────────────────────────
    # When they complete the wizard — used to redirect incomplete users
    add_column :users, :onboarding_completed_at, :datetime

    # ── Body measurements ─────────────────────────────────────────────────────
    # Option A: JSONB (flexible, harder to validate/query)
    add_column :users, :body_profile, :jsonb, default: {}

    # Option B: Individual columns (easier to validate, query, index)
    # Uncomment these if you prefer explicit columns over jsonb:
    #
    # add_column :users, :size_preset, :string      # "M", "L", "XL"  
    # add_column :users, :height_cm, :decimal, precision: 5, scale: 2
    # add_column :users, :bust_cm, :decimal, precision: 5, scale: 2
    # add_column :users, :waist_cm, :decimal, precision: 5, scale: 2
    # add_column :users, :hip_cm, :decimal, precision: 5, scale: 2
    # add_column :users, :unit, :string, default: 'imperial' # 'imperial' | 'metric'

    # ── Pose preferences ──────────────────────────────────────────────────────
    # For 3D mannequin presets + Fal.ai prompt injection
    add_column :users, :pose_vibe, :string
    add_column :users, :pose_notes, :text

    # ── Indexes for performance ───────────────────────────────────────────────
    # Admin queries: "show me users who haven't completed onboarding"
    add_index :users, :onboarding_completed_at
    
    # JSON queries: "users with specific pose vibes"
    add_index :users, :pose_vibe
    
    # JSONB index for body_profile queries (Postgres only)
    add_index :users, :body_profile, using: :gin
  end
end