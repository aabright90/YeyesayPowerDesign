# frozen_string_literal: true

# ─── REFERENCE: Add this block to your existing Rails routes.rb ──────────────
#
# Rails routes map HTTP verbs + URL paths to controller#action methods.
# This is the equivalent of Next.js file-based routing (app/api/mutate/route.ts)
# but explicit and centralized.
#
# Key differences from Next.js:
#   Next.js: File path IS the route (app/api/v1/users/route.ts → /api/v1/users)
#   Rails:   routes.rb maps paths to controller methods manually
#
# You can inspect all routes with:  rails routes
# Or filter:                        rails routes | grep user
# ─────────────────────────────────────────────────────────────────────────────

Rails.application.routes.draw do
  # ── API namespace ──────────────────────────────────────────────────────────
  #
  # `namespace` does three things simultaneously:
  #   1. Prefixes the URL:        /api/v1/...
  #   2. Expects the controller:  Api::V1::UsersController
  #   3. Expects the file at:     app/controllers/api/v1/users_controller.rb
  #
  # This is how Rails does API versioning — each version is a module.

  namespace :api do
    namespace :v1 do
      # ── Devise JWT auth routes ──
      devise_for :users, controllers: {
        sessions:      'api/v1/sessions',
        registrations: 'api/v1/registrations'
      }

      # ── Current user profile endpoints ──
      #
      # /me routes for onboarding + profile management
      # These are separate from RESTful /users/:id to focus on "current user"
      #
      get    'me', to: 'me#show'                    # GET    /api/v1/me
      patch  'me', to: 'me#update'                  # PATCH  /api/v1/me  
      patch  'me/face_photo', to: 'me#update_face_photo'  # PATCH  /api/v1/me/face_photo
      post   'me/complete_onboarding', to: 'me#complete_onboarding'  # POST   /api/v1/me/complete_onboarding

      # ── Custom mesh upload ──
      #
      # `patch` maps HTTP PATCH to a specific controller action.
      #
      # PATCH vs PUT:
      #   PATCH = partial update (change one field)
      #   PUT   = full replacement (send the entire resource)
      #
      # We use PATCH because we're only updating the avatar_mesh,
      # not replacing the entire User record.
      #
      # This generates:
      #   PATCH  /api/v1/users/update_mesh  →  Api::V1::UsersController#update_mesh
      #
      patch 'users/update_mesh', to: 'users#update_mesh'

      # ── RESTful resources ──
      #
      # `resources` generates all 7 RESTful routes automatically:
      #   GET    /garments          → index
      #   GET    /garments/:id      → show
      #   POST   /garments          → create
      #   PATCH  /garments/:id      → update
      #   PUT    /garments/:id      → update
      #   DELETE /garments/:id      → destroy
      #
      # `only:` limits which routes are generated.
      # `member` adds action to specific resource: /garments/:id/process
      #
      resources :garments, only: [:index, :show, :create, :update, :destroy] do
        member do
          post :process  # POST /api/v1/garments/:id/process
        end
      end
      resources :generations, only: [:create, :show]
    end
  end
end

# ─── EXAM CHEAT SHEET: Rails Routing ────────────────────────────────────────
#
# 1. ROUTE HELPERS (generated automatically):
#    resources :courses generates:
#      courses_path          → "/courses"        (index, create)
#      course_path(id)       → "/courses/42"     (show, update, destroy)
#      new_course_path       → "/courses/new"
#      edit_course_path(id)  → "/courses/42/edit"
#
# 2. NESTED RESOURCES:
#    resources :courses do
#      resources :lessons    → /courses/:course_id/lessons/:id
#    end
#
# 3. MEMBER vs COLLECTION:
#    resources :courses do
#      member do
#        post :enroll        → POST /courses/:id/enroll (acts on ONE course)
#      end
#      collection do
#        get :featured       → GET /courses/featured (acts on the collection)
#      end
#    end
#
# 4. CONSTRAINTS:
#    get '/courses/:id', constraints: { id: /\d+/ }  → only numeric IDs
#
# 5. SCOPE vs NAMESPACE:
#    namespace :api → URL prefix + module prefix + file path
#    scope :api     → URL prefix only (controller stays in root)
#    scope module: :api → module prefix only (no URL change)
# ────────────────────────────────────────────────────────────────────────────
