# Help Joe Parallel Park

A rough playable p5.js prototype. Back Joe's convertible into the gap between the delivery van and the mail truck, seen from the side.

- **GO / BACK** (or the right / left arrow keys): drive. The cars face right, so BACK goes left.
- **Wheel**: tap to turn it (it lights up green), tap again to straighten. It straightens by itself once Joe reaches the curb. On a keyboard, hold space instead.
- With the wheel turned, driving swings Joe in toward the curb. Turn too early or too late and he bumps a car: a BUMP star and a paper puff pop out, the car rocks, the phone buzzes, and Joe gets angry for a moment.
- First two rounds: the wheel pulses with TURN at the right moment.
- Hold still in the spot for half a second (the outline fills green) to park. Joe's car hops, and the card shows your best park on this device.
- Stars: 3 = no bumps and under 15 s, 2 = one bump or under 25 s, 1 = parked. Each round the gap gets a bit tighter.

## Art

- `Exports/`: the original cut-outs (Joe's car without wheels, happy and angry; Joe's wheel; the van; the mail truck).
- `assets/`: trimmed, smaller WebP copies the game loads, plus `street.webp`, the cut-paper street drawn from the reference photo (buildings kept, cars and trees removed).
- Car sizes are set by `CAR_LEN`, `VAN_LEN` and `TRUCK_LEN` at the top of `sketch.js`. `JOE_WHEELS` says where Joe's two wheels sit on the car image; they spin as far as the car rolls.

## Run it

```bash
python3 -m http.server 8771
```

Then open http://localhost:8771.
