# Pose System Documentation

## Overview

The pose system allows users to select attitude/vibe presets that affect both the 3D mannequin display and the final Fal.ai image generation.

## Database Schema

**User model fields:**
```ruby
# Pose preferences for 3D mannequin + Fal.ai prompts
pose_vibe: string         # One of: elegant, sassy, sexy, casual, power, playful
pose_notes: text          # Optional freeform notes
```

## Allowed Pose Vibes

- `elegant` - Refined, graceful positioning
- `sassy` - Confident, attitude-filled stance  
- `sexy` - Alluring, sultry positioning
- `casual` - Relaxed, everyday posture
- `power` - Strong, commanding presence
- `playful` - Fun, energetic positioning

## API Usage

### Update user's pose preference:
```bash
PATCH /api/v1/me
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "user": {
    "pose_vibe": "elegant",
    "pose_notes": "Slight head tilt, hands clasped"
  }
}
```

### Get current pose settings:
```bash
GET /api/v1/me
Authorization: Bearer <jwt_token>

# Response includes:
{
  "pose_vibe": "elegant",
  "pose_notes": "Slight head tilt, hands clasped"
}
```

## Implementation Notes

### 3D Mannequin (Next.js/R3F)
The pose_vibe should map to preset rotations/positions:

```javascript
const POSE_PRESETS = {
  elegant: { hipRotation: 5, spineAngle: 2, armSpread: 10 },
  sassy: { hipRotation: 15, spineAngle: -5, armSpread: 25 },
  sexy: { hipRotation: 20, spineAngle: 8, armSpread: 15 },
  casual: { hipRotation: 0, spineAngle: 0, armSpread: 5 },
  power: { hipRotation: -10, spineAngle: -8, armSpread: 35 },
  playful: { hipRotation: 12, spineAngle: 3, armSpread: 20 }
};
```

### Fal.ai Integration (Your Responsibility)
When generating images, inject pose_vibe into the prompt:

```javascript
// Example prompt modification
const poseDescription = {
  elegant: "standing gracefully with refined posture",
  sassy: "confident stance with attitude, hand on hip", 
  sexy: "alluring pose with sultry positioning",
  casual: "relaxed, natural everyday posture",
  power: "strong, commanding presence with confident stance",
  playful: "energetic, fun positioning with dynamic angles"
};

const fullPrompt = `Fashion editorial photo. ${poseDescription[user.pose_vibe]}. ${user.pose_notes || ''}`;
```

## Validation

The User model validates pose_vibe against allowed values:

```ruby
validates :pose_vibe, inclusion: { 
  in: %w[elegant sassy sexy casual power playful],
  message: "%{value} is not a valid pose vibe"
}, allow_blank: true
```

## Admin Queries

```ruby
# Find users by pose preference
User.by_pose_vibe('elegant')

# Users with custom pose notes
User.where.not(pose_notes: [nil, ''])

# Most popular pose vibes
User.group(:pose_vibe).count
```

## Client Flow

1. **Onboarding Step 4**: User selects pose vibe from chips/buttons
2. **3D Mannequin**: Instantly applies preset rotations
3. **PATCH /api/v1/me**: Persists selection to Rails
4. **Generation**: Fal.ai prompt includes pose description
5. **Results**: Generated image reflects the chosen attitude

This creates consistency between the "try-on" experience and final editorial photos.