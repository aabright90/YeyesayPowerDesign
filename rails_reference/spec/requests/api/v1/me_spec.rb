# frozen_string_literal: true

# ─── REQUEST SPEC FOR ME CONTROLLER ───────────────────────────────────────────
#
# CRASH COURSE — RAILS REQUEST SPECS:
#
# • Request specs test the full HTTP stack (routing + controller + response)
# • Use RSpec: describe, context, it, expect
# • HTTP verbs: get, post, patch, delete
# • Headers: { 'Authorization' => 'Bearer token' }
# • JSON parsing: JSON.parse(response.body)
# • Status assertions: expect(response).to have_http_status(:ok)
# • Factory pattern: FactoryBot.create(:user) vs build (no DB save)

require 'rails_helper'

RSpec.describe 'Api::V1::Me', type: :request do
  let!(:user) { create(:user) }
  let(:auth_headers) { { 'Authorization' => "Bearer #{generate_jwt_token(user)}" } }

  describe 'GET /api/v1/me' do
    context 'when authenticated' do
      it 'returns user profile with onboarding status' do
        get '/api/v1/me', headers: auth_headers

        expect(response).to have_http_status(:ok)
        
        json = JSON.parse(response.body)
        expect(json['id']).to eq(user.id)
        expect(json['email']).to eq(user.email)
        expect(json['onboarding_complete']).to be_falsey
        expect(json).to have_key('measurements')
        expect(json).to have_key('face_photo_url')
        expect(json).to have_key('avatar_mesh_url')
      end

      it 'includes attachment URLs when files are attached' do
        # Attach a face photo
        user.face_photo.attach(
          io: File.open(Rails.root.join('spec/fixtures/files/face.jpg')),
          filename: 'face.jpg',
          content_type: 'image/jpeg'
        )

        get '/api/v1/me', headers: auth_headers

        json = JSON.parse(response.body)
        expect(json['face_photo_url']).to be_present
        expect(json['face_photo_url']).to include('face.jpg')
      end
    end

    context 'when unauthenticated' do
      it 'returns 401 unauthorized' do
        get '/api/v1/me'

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'PATCH /api/v1/me' do
    let(:valid_params) do
      {
        user: {
          display_name: 'Jane Doe',
          phone: '+1-555-123-4567',
          bio: 'Fashion enthusiast',
          pose_vibe: 'elegant',
          body_profile: {
            height: 170,
            chest: 85,
            waist: 65,
            hips: 90,
            unit: 'metric',
            size_preset: 'M'
          }
        }
      }
    end

    context 'with valid parameters' do
      it 'updates user profile' do
        patch '/api/v1/me', params: valid_params, headers: auth_headers

        expect(response).to have_http_status(:ok)
        
        json = JSON.parse(response.body)
        expect(json['message']).to eq('Profile updated successfully')
        expect(json['user']['display_name']).to eq('Jane Doe')
        
        user.reload
        expect(user.display_name).to eq('Jane Doe')
        expect(user.pose_vibe).to eq('elegant')
        expect(user.body_profile['height']).to eq(170)
      end
    end

    context 'with invalid parameters' do
      it 'returns validation errors for invalid pose_vibe' do
        invalid_params = valid_params.deep_merge(
          user: { pose_vibe: 'invalid_pose' }
        )

        patch '/api/v1/me', params: invalid_params, headers: auth_headers

        expect(response).to have_http_status(:unprocessable_entity)
        
        json = JSON.parse(response.body)
        expect(json['error']).to be_present
        expect(json['errors']).to include(/not a valid pose vibe/)
      end

      it 'returns validation errors for oversized bio' do
        invalid_params = valid_params.deep_merge(
          user: { bio: 'x' * 501 }  # Exceeds 500 char limit
        )

        patch '/api/v1/me', params: invalid_params, headers: auth_headers

        expect(response).to have_http_status(:unprocessable_entity)
        
        json = JSON.parse(response.body)
        expect(json['errors']).to include(/too long/)
      end
    end
  end

  describe 'PATCH /api/v1/me/face_photo' do
    let(:image_file) do
      fixture_file_upload(
        Rails.root.join('spec/fixtures/files/face.jpg'), 
        'image/jpeg'
      )
    end

    context 'with valid image file' do
      it 'uploads face photo successfully' do
        patch '/api/v1/me/face_photo', 
              params: { face_photo: image_file }, 
              headers: auth_headers

        expect(response).to have_http_status(:ok)
        
        json = JSON.parse(response.body)
        expect(json['message']).to eq('Face photo uploaded successfully')
        expect(json['face_photo_url']).to be_present
        
        user.reload
        expect(user.face_photo).to be_attached
      end
    end

    context 'without file' do
      it 'returns error' do
        patch '/api/v1/me/face_photo', headers: auth_headers

        expect(response).to have_http_status(:unprocessable_entity)
        
        json = JSON.parse(response.body)
        expect(json['error']).to eq('No face photo provided')
      end
    end
  end

  describe 'POST /api/v1/me/complete_onboarding' do
    context 'when requirements are met' do
      before do
        user.update!(
          display_name: 'Complete User',
          body_profile: { height: 170, chest: 85 }
        )
        user.face_photo.attach(
          io: File.open(Rails.root.join('spec/fixtures/files/face.jpg')),
          filename: 'face.jpg',
          content_type: 'image/jpeg'
        )
      end

      it 'marks onboarding as complete' do
        post '/api/v1/me/complete_onboarding', headers: auth_headers

        expect(response).to have_http_status(:ok)
        
        json = JSON.parse(response.body)
        expect(json['message']).to eq('Onboarding completed successfully')
        expect(json['onboarding_completed_at']).to be_present
        expect(json['redirect_to']).to eq('/studio')
        
        user.reload
        expect(user.onboarding_complete?).to be_truthy
      end
    end

    context 'when requirements are not met' do
      it 'returns missing fields error' do
        post '/api/v1/me/complete_onboarding', headers: auth_headers

        expect(response).to have_http_status(:unprocessable_entity)
        
        json = JSON.parse(response.body)
        expect(json['error']).to eq('Onboarding requirements not met')
        expect(json['missing_fields']).to include('display_name', 'face_photo', 'measurements')
        expect(json['requirements']).to be_present
      end
    end
  end

  # ── Helper methods for spec setup ─────────────────────────────────────────

  private

  def generate_jwt_token(user)
    # Mock JWT token generation - adjust based on your JWT implementation
    # In real app, this would use your Devise JWT setup
    JWT.encode(
      { 
        sub: user.id, 
        exp: 1.day.from_now.to_i 
      }, 
      Rails.application.secret_key_base
    )
  end
end

# ─── FACTORY FOR TESTING ──────────────────────────────────────────────────────
#
# Add this to spec/factories/users.rb:
#
# FactoryBot.define do
#   factory :user do
#     sequence(:email) { |n| "user#{n}@example.com" }
#     password { "password123" }
#     password_confirmation { "password123" }
#     display_name { Faker::Name.name }
#     
#     trait :with_face_photo do
#       after(:create) do |user|
#         user.face_photo.attach(
#           io: File.open(Rails.root.join('spec/fixtures/files/face.jpg')),
#           filename: 'face.jpg',
#           content_type: 'image/jpeg'
#         )
#       end
#     end
#     
#     trait :onboarding_complete do
#       display_name { "Complete User" }
#       onboarding_completed_at { 1.day.ago }
#       body_profile do
#         {
#           height: 170,
#           chest: 85,
#           waist: 65,
#           hips: 90,
#           unit: 'metric'
#         }
#       end
#       
#       with_face_photo
#     end
#   end
# end