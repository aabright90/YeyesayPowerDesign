#!/usr/bin/env bash
# One-time setup: copies the generated Ruby pose images into public/
# Run from the YeyesayPowerDesign directory:  bash setup-poses.sh

ASSETS="/home/quantum-crusader/.cursor/projects/home-quantum-crusader-Desktop-projects-yeye-fasion-engine/assets"
PUBLIC="$(dirname "$0")/public"

mkdir -p "$PUBLIC"

cp "$ASSETS/ruby-beach.jpg"     "$PUBLIC/ruby-beach.jpg"     && echo "✓ ruby-beach.jpg"
cp "$ASSETS/ruby-red-dress.jpg" "$PUBLIC/ruby-red-dress.jpg" && echo "✓ ruby-red-dress.jpg"
cp "$ASSETS/ruby-studio.jpg"    "$PUBLIC/ruby-studio.jpg"    && echo "✓ ruby-studio.jpg"

echo ""
echo "All pose images are in public/. Start the dev server and the pose selector will show them."
