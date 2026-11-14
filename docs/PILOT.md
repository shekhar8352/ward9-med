# Ward 9 pilot

The paper case sheet stays the official medical record. The app records who did each step, and when.

## Before day 1

- DLT entity, header, and OTP template approved.
- Supabase project in `ap-south-1` with migrations applied.
- PowerSync Cloud instance region `in`.
- Play Console internal testing track. Android APK from `eas build --profile pilot`.
- Five doctors with invite rows and phones that receive OTP.
- Named admin for lost-phone revoke.

## Fictional patients (first three days)

Demo seed (also loaded when `EXPO_PUBLIC_DEMO` is not `0`):

| Name | Age | Path |
| --- | --- | --- |
| Ravi Kumar (demo) | 62 | Compound, Ayushman applied, THR, sitting in fitness |
| Anita Devi (demo) | 16 | MLC, non-compound, pediatric, labs pending |
| Imran Ali (demo) | 45 | Ayushman not applied, echo unfit, needs attention |

Walkthrough on two Android phones:

1. Sign in as Dr Asha (`+919999000002`) and Dr Bharat (`+919999000003`). PIN `1234` after first OTP (`123456` in demo).
2. Open Patients. Confirm all three names, stage badges, MLC / Ayushman flags.
3. Airplane mode on both phones. Tick daily dressing on Ravi on phone A. Tick a fitness item on phone B.
4. Reconnect. Both ticks appear within a minute.
5. Force a conflict: airplane mode, both edit Ravi blood report, reconnect A then B. The later write stays. The other doctor sees “Kept a later entry”.
6. Move Imran pre-OT → Return to fitness with a reason. `fitness_attempt` increments.
7. Take a wound photo on Anita with consent on. Confirm the other phone shows “still on Dr Asha’s phone” until upload finishes.
8. Revoke a spare device from Admin. Confirm that phone wipes on next foreground.

## Two-week live parallel

Days 1–2: a developer is in the ward. Blockers only.

Success:

- Every active patient is on the list.
- A tick during a Wi-Fi outage appears on a second phone after reconnect.
- Nobody needs WhatsApp to move a patient to OT.

If doctors stop opening the app, stop the rollout.

## Android internal build

```bash
cd apps/mobile
npx eas login
npx eas build --platform android --profile pilot
npx eas submit --platform android --profile production --track internal
```

Use the internal testing track so a public Play listing is not on the critical path.
