# Three-phase motor load test

Complete the wiring and current loops, click CHECK (or Auto Connect), switch on
the MCB, and click the autotransformer knob to set the **400 V line supply**.
The analyser shows phase RMS voltage/current and total three-phase power at 50 Hz.

Click **ADD** to save the no-load reading. Then click the hand beside the rig:
it moves to and turns the top handle, advances to the next supplied image, and
updates the analyser and mechanical readings. Wait for the animation to finish,
click ADD, and repeat until all six conditions are saved. Each stage must be
recorded before advancing; repeated clicks cannot skip a load. RESET cancels a
running animation and clears the load, readings, supply, and wiring.

`src/assets/1.png` through `6.png` correspond to W1/W2 weights **0/0, 7.5/2,
12/2.5, 16/5, 20/6, 22.5/7 kg**. Measurements are in
`src/utils/motorLoadReadings.js`; the observation table and report share the same
12-column definition. Torque uses **T = (W1 − W2) × 0.075 × 9.81 N·m** and is
truncated to two decimals to match the supplied table exactly. The supplied
phase readings are retained separately from the 400 V line-voltage setting.

PLOT displays speed and total input power versus torque. Generate Report uses
the same six saved observations. The transparent hand asset and generation
prompt are documented in `src/assets/pulley-hand.md`.

Run data and wiring checks with `node --test src/utils/*.test.js`.

# Apparatus wiring

Terminals and required connections are defined in `src/config/circuitConnections.js`.
Port and label positions are grouped by device in `src/ConnectionEndpoints.css`.

| Apparatus | Numbers | Terminal ID example |
| --- | --- | --- |
| MCB | 1, 2, 3 | `mcb-terminal-1` |
| Autotransformer input | 4, 5, 6 | `autotransformer-input-terminal-4` |
| Autotransformer output | 7, 8, 9 | `autotransformer-output-terminal-7` |
| Power analyser | 10, 11, 12, 13, 14, 15 | `power-analyser-terminal-10` |
| Pulley | 16, 17, 18 | `pulley-terminal-16` |

Required pairs: **1-4, 2-5, 3-6, 7-10, 8-11, 9-12, 7-16, 8-17, 9-18**.
Power analyser terminals **13, 14, and 15** have red, yellow, and blue current-probe leads that
curve around the right side and end in circular loops around motor wires
**7-16 (red), 8-17 (yellow), and 9-18 (blue)**, respectively. After connecting a
motor wire, drag its analyser port to the dashed circular target on that wire,
or select the port and then the target (Enter/Space also work). Each loop is a
separate manual connection. Clicking 13, 14, or 15's number removes only that
loop; removing a motor wire also removes its attached loop. Loops clamp around
the wires rather than joining the analyser to another numbered terminal.

Drag between two ports or select two ports to connect them. Keyboard users can
focus each port and press Enter or Space. Escape cancels a selection or wire preview.
Select a terminal's numbered label to remove all wires attached to that terminal.
CHECK requires all nine wire pairs and all three loops. Auto Connect places all
twelve connections and locks the wiring.
RESET clears the wires and unlocks the terminals.

Ports use the IDs above, their wrappers append `-assembly`, and number labels append
`-label`. Wires are SVG paths with class `circuit-wire`, a `wire-1-4` pair class,
and `data-source-terminal` / `data-target-terminal` attributes. No library-generated
endpoint IDs or classes are needed.

Run wiring validation tests with `node --test src/utils/circuitWiring.test.js`.

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
