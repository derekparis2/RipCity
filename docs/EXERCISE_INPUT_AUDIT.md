# Starter Exercise Input Audit

This is the working review list for the 88 starter exercises before they become
the universal catalog. It separates coach-approved corrections from educated
recommendations that still require approval before changing catalog data.

## Confirmed Input Behavior

- `Band + Reps` exercises require actual reps; band color is optional context.
- `Each Side` exercises still collect one weight and one reps value. The reps
  value means the completed reps on both sides.
- Prescribed-distance drills use a coach-entered target such as `20 yards`, but
  members only mark the work complete.
- Measured-distance exercises collect the member's actual distance. A value of
  `0` means completed but not measured and is valid workout data.

## Band Color Exercises

The current eight band-color defaults can keep their input type. The member UI
now requires reps and offers band color as an optional field:

- Assisted Pull-Up
- Band Row
- Band Pull-Apart
- Band External Rotation
- Band Internal Rotation
- J-Band Routine
- Band No Money
- Serratus Wall Slide

## Approved Catalog Corrections

The Vertical Jump and medicine-ball corrections were applied to staging on
2026-09-14. Production remains unchanged until the reviewed V2 production
migration sequence is released.

Coach-approved measured-distance exercises:

- Broad Jump
- Vertical Jump (added to the starter catalog)

Medicine-ball exercises use `weight_reps` so the member records the
ball weight and completed reps, not throwing distance:

- Med Ball Chest Pass
- Med Ball Shot Put (`Each Side` by default)
- Med Ball Slam

The following coach-approved prescribed-distance exercises now use
`completion` in staging while keeping the coach-entered distance target:

- Lateral Shuffle
- Carioca
- A-Skip
- High Knees
- Backpedal
- Farmer Carry
- Suitcase Carry
- Bear Crawl
- Sled Push
- Sled Pull

## Approved Each-Side Defaults

The following exercises now default to `Each Side` in staging:

- Single-Leg RDL
- Split Squat
- Rear-Foot Elevated Split Squat
- Lateral Lunge
- Reverse Lunge
- Step-Up
- Half-Kneeling DB Press
- Med Ball Shot Put
- Single-Arm DB Row
- Skater Jump
- Lateral Bound
- Pallof Press
- Side Plank
- Suitcase Carry
- Bird Dog
- Thoracic Open Book
- Band External Rotation
- Band Internal Rotation
- Wrist Pronation/Supination
- Wrist Flexion/Extension

The remaining approved corrections are source-controlled in
`20260914223000_apply_approved_exercise_input_audit.sql` and were applied to
staging on 2026-09-14. Continue testing the builder defaults and each member
input type. Preserve all approved corrections when the starter list becomes
the universal catalog.
