import os
import subprocess
import glob

mcap_files = glob.glob('tests/fixtures/**/*.mcap', recursive=True)
report = []
report.append("# Recorded Rosbags Summary (Phase P2)\n\n")
report.append("| Robot | Scenario | Label | Size | Duration | Messages |\n")
report.append("|---|---|---|---|---|---|\n")

for mcap in sorted(mcap_files):
    # path: tests/fixtures/<robot>/<scenario>/bags/<label>/<file>.mcap
    parts = mcap.split(os.sep)
    try:
        fixture_idx = parts.index('fixtures')
        robot = parts[fixture_idx + 1]
        scenario = parts[fixture_idx + 2]
        label = parts[fixture_idx + 4] # .../bags/<label>/file.mcap
    except Exception:
        robot, scenario, label = "unknown", "unknown", "unknown"

    size_mb = os.path.getsize(mcap) / (1024 * 1024)
    duration = "N/A"
    msgs = "N/A"

    try:
        res = subprocess.run(['ros2', 'bag', 'info', mcap], capture_output=True, text=True, timeout=5)
        for line in res.stdout.split('\n'):
            line_str = line.strip()
            if line_str.startswith('Duration:'):
                duration = line_str.split(':', 1)[1].strip()
            elif line_str.startswith('Messages:'):
                msgs = line_str.split(':', 1)[1].strip()
    except Exception:
        pass

    report.append(f"| {robot} | {scenario} | {label} | {size_mb:.2f} MiB | {duration} | {msgs} |\n")

with open('tests/fixtures/bags_summary.md', 'w') as out:
    out.writelines(report)

print("Generated tests/fixtures/bags_summary.md")
