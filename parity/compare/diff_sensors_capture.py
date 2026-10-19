"""Compare two capture_reference.sh snapshots (A, B), e.g. a committed fixture and a test capture.
Compared: node list, topic list with types, QoS of every endpoint (reliability, history/depth, durability,
lifespan, deadline, liveliness, lease, node, type, type hash), TF frames and edges (from frames_*.gv),
parameter names and values (params/*.yaml), plus service and action lists.
Ignored: stamps, GIDs, pids (launch_ros_<pid>, transform_listener_impl_<id>, _ros2cli_daemon_<domain>_<id> are normalised) and rates (*_hz.txt).
Usage: diff_sensors.py <dir A> <dir B>   (exit 1 if anything differs)
"""
import glob, os, re, sys
import yaml

A, B = sys.argv[1], sys.argv[2]
norm = lambda s: re.sub(r'_ros2cli_daemon_(\d+)_[0-9a-f]+', r'_ros2cli_daemon_<domain>_<id>',
                       re.sub(r'transform_listener_impl_[0-9a-f]+', 'transform_listener_impl_<id>',
                              re.sub(r'launch_ros_\d+', 'launch_ros_<pid>', s)))
diffs = []


def lines(d, f):
    p = os.path.join(d, f)
    return sorted(norm(l.rstrip()) for l in open(p) if l.strip()) if os.path.exists(p) else None


def cmp(label, a, b):
    if a == b:
        print(f'{label}: identical ({len(a) if a is not None else 0} entries)')
        return
    sa, sb = set(a or []), set(b or [])
    diffs.append(label)
    print(f'{label}: DIFFERENT')
    for x in sorted(sa - sb): print(f'   only in A: {x}')
    for x in sorted(sb - sa): print(f'   only in B: {x}')
    if sa == sb: print('   (same entries, different multiplicity)')


for f in ('node_list.txt', 'topic_list.txt', 'service_list.txt', 'action_list.txt'):
    cmp(f, lines(A, f), lines(B, f))


def qos(path):
    keep = ('Node name', 'Node namespace', 'Topic type', 'Topic type hash', 'Endpoint type', 'Reliability',
            'History (Depth)', 'Durability', 'Lifespan', 'Deadline', 'Liveliness', 'Liveliness lease duration',
            'Publisher count', 'Subscription count', 'Type')
    eps, cur, head = [], {}, []
    for l in open(path):
        l = l.strip()
        if ':' not in l:
            if l: head.append(l)
            continue
        k, v = (x.strip() for x in l.split(':', 1))
        if k == 'Node name' and cur:
            eps.append(cur); cur = {}
        if k in ('Publisher count', 'Subscription count') or (k == 'Type' and not cur):
            if cur: eps.append(cur); cur = {}
            head.append(f'{k}: {v}'); continue
        if k in keep:
            cur[k] = norm(v)
    if cur: eps.append(cur)
    return sorted(head) + sorted(' | '.join(f'{k}={e[k]}' for k in sorted(e)) for e in eps)


qa = {os.path.basename(p) for p in glob.glob(f'{A}/qos/*.txt') if not p.endswith('_hz.txt')}
qb = {os.path.basename(p) for p in glob.glob(f'{B}/qos/*.txt') if not p.endswith('_hz.txt')}
cmp('qos files (topics)', sorted(qa), sorted(qb))
n_same = 0
for f in sorted(qa & qb):
    a, b = qos(f'{A}/qos/{f}'), qos(f'{B}/qos/{f}')
    if a == b: n_same += 1
    else: cmp(f'qos/{f}', a, b)
print(f'qos profiles: {n_same} of {len(qa & qb)} common topic files identical')


def tf(d):
    gv = sorted(glob.glob(f'{d}/frames_*.gv'))
    if not gv: return None, None
    t = open(gv[-1]).read()
    edges = sorted(set(re.findall(r'"([^"]+)" -> "([^"]+)"', t)))
    frames = sorted({x for e in edges for x in e})
    return frames, [f'{a} -> {b}' for a, b in edges]


fa, ea = tf(A); fb, eb = tf(B)
cmp('TF frames', fa, fb); cmp('TF edges', ea, eb)


def flat(o, p=''):
    if isinstance(o, dict):
        for k, v in o.items(): yield from flat(v, f'{p}/{k}' if p else str(k))
    else:
        yield f'{p} = {o!r}'


pa = {norm(os.path.basename(p)): p for p in glob.glob(f'{A}/params/*.yaml')}
pb = {norm(os.path.basename(p)): p for p in glob.glob(f'{B}/params/*.yaml')}
cmp('param files (nodes)', sorted(pa), sorted(pb))
for n in sorted(set(pa) & set(pb)):
    ya, yb = (yaml.safe_load(open(x)) for x in (pa[n], pb[n]))
    cmp(f'params/{n}', sorted(norm(x) for x in flat(ya)), sorted(norm(x) for x in flat(yb)))

print('\nRESULT:', 'IDENTICAL' if not diffs else f'{len(diffs)} DIFFERENCES: ' + ', '.join(diffs))
sys.exit(1 if diffs else 0)
