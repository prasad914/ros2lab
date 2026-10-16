# Parity Failures / Unverified Configurations

Reference: `parity/CLAUDE.md` and `parity/reference/nav2_jazzy_spec.md` S4.

## Unverified Global Planner: Smac State Lattice (`nav2_smac_planner::SmacPlannerLattice`)

The following 5 planner × controller combinations could not be built or verified in the browser emulator or standard ROS 2 Jazzy execution because `nav2_smac_planner::SmacPlannerLattice` requires an external vehicle lattice graph file (`.lattice`) which is not bundled with standard ROS 2 Jazzy apt distribution packages:

1. `SmacLattice_MPPI`
2. `SmacLattice_DWB`
3. `SmacLattice_RPP`
4. `SmacLattice_RotationShimRPP`
5. `SmacLattice_Graceful`

### Error Signature
When launched with real ROS 2 Jazzy, the node outputs:
```
[INFO] [planner_server]: Created global planner plugin GlobalPlanner of type nav2_smac_planner::SmacPlannerLattice
[ERROR] [planner_server]: Failed to create global planner. Exception: Could not open lattice file!
```

### Evidence
- Captured logs and metadata: `parity/fixtures/tb3_burger/nav2_bringup/logs/SmacLattice_*_unverified.log`
- Status: Recorded as FAILED / UNVERIFIED in parity test matrix per spec rule.
