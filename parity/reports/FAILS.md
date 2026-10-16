# Parity Failures / Unverified Configurations

Reference: `parity/CLAUDE.md` and `parity/reference/nav2_jazzy_spec.md` S4.

## Smac State Lattice Planner (`nav2_smac_planner::SmacPlannerLattice`)

- **Status:** Resolved / Verified Configuration.
- **Rationale:** The earlier failure ("Could not open lattice file!") was resolved by supplying the Jazzy sample primitives path: `/opt/ros/jazzy/share/nav2_smac_planner/sample_primitives/5cm_resolution/0.5m_turning_radius/diff/output.json` matching the map resolution (`0.05`). All 5 SmacLattice planner × controller configurations successfully load lifecycle nodes and configure/activate.
