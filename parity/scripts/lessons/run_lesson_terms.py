#!/usr/bin/env python3
"""Run every practice-terminal solution of content/course-content.json in a REAL bash with ROS 2 Jazzy.

Each term block gets a fresh scratch HOME (~/lesson_ws/homes/<lesson>_t<N>) seeded with the block's starting files
(dumped from the site's Shell by dump_term_blocks.mjs), Ubuntu's /etc/skel/.bashrc and .profile (plus
`source /opt/ros/jazzy/setup.bash` when the block starts "sourced"), and ROS_DOMAIN_ID=52.
Every terminal is a real interactive bash on a pty. Nodes the block lists as already running ("running") are
started first in their own terminals. Steps:
  string   typed in the current terminal; output is read until the prompt comes back or the step's window ends.
           A command still running when the next command is typed in the SAME terminal gets Ctrl+C first
           (a student would do the same); before {"newTerminal"} it is left running.
  nano     the same text replacement the site applies (first occurrence), done on the real file.
  viz / rvizGoal / rvizSave   clicks in the RViz GUI: PENDING (GUI action, not typed).
Commands with sudo / apt / dpkg -i / add-apt-repository / rosdep install are never sent: PENDING (run rules).
Output: parity/fixtures/lessons/<lesson>/term<N>_runner.log (human readable) and term<N>.json (structured).
Usage: run_lesson_terms.py <blocks.json> [lesson ids...]
"""
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time

import pexpect

DOMAIN = '52'
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
SCRATCH = os.path.expanduser('~/lesson_ws/homes')
OUT_ROOT = os.path.join(REPO, 'parity', 'fixtures', 'lessons')
SITE_HOME = '/home/student'
PROMPT = re.compile(r'__PRM_(\d+)__\r*\n')
ANSI = re.compile(r'\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b[()][A-Za-z0-9]|\x1b[=>]|\x1b\][^\x07]*\x07')
FORBIDDEN = re.compile(r'(^|[;&|]\s*)(sudo|apt|apt-get|add-apt-repository|dpkg)\b|\brosdep install\b|\bmake install\b')
RUNNING_CMD = {
    'turtlesim': 'ros2 run turtlesim turtlesim_node',
    'teleop': 'ros2 run turtlesim turtle_teleop_key',
    'talker': 'ros2 run demo_nodes_cpp talker',
    'listener': 'ros2 run demo_nodes_py listener',
}


def window(cmd):
    c = cmd.strip()
    if re.match(r'colcon (build|test)\b', c):
        return 900
    if c.startswith('rosdep update'):
        return 180
    if re.match(r'ros2 launch (turtlebot3_gazebo|moveit_resources)', c):
        return 25
    if re.match(r'ros2 (launch|run)\b|rviz2\b|rqt_graph\b|ros2 topic hz\b|ros2 bag (record|play)\b', c) or \
            (c.startswith('ros2 topic echo') and '--once' not in c):
        return 8
    if c.startswith('ros2 doctor'):
        return 120
    if c.startswith('ros2 action send_goal'):
        return 40
    return 15


class Term:
    def __init__(self, n, home, env, cwd):
        self.n = n
        self.p = pexpect.spawn('/bin/bash', ['-i'], env=env, cwd=cwd, encoding='utf-8', codec_errors='replace',
                               dimensions=(50, 220), timeout=30)
        self.busy = None   # command still running in this terminal
        time.sleep(1.0)
        self.p.sendline(" stty -echo; PS1='__PRM_$?__\\n'; PS2=''; unset PROMPT_COMMAND; bind \'set enable-bracketed-paste off\' 2>/dev/null; history -c")
        self.p.expect(PROMPT, timeout=30)
        self.drain()

    def drain(self):
        out = ''
        while True:
            try:
                out += self.p.read_nonblocking(65536, timeout=0.05)
            except (pexpect.TIMEOUT, pexpect.EOF):
                return out

    def cwd(self):
        try:
            return os.readlink(f'/proc/{self.p.pid}/cwd')
        except OSError:
            return None

    def run(self, cmd, win):
        self.p.sendline(cmd)
        t0 = time.time()
        i = self.p.expect([PROMPT, pexpect.TIMEOUT, pexpect.EOF], timeout=win)
        dt = time.time() - t0
        if i == 0:
            return dict(out=self.p.before, exit=int(self.p.match.group(1)), secs=round(dt, 1), state='finished')
        out = self.p.before if isinstance(self.p.before, str) else ''
        if i == 2:
            return dict(out=out, exit=None, secs=round(dt, 1), state='terminal closed')
        self.busy = cmd
        return dict(out=out, exit=None, secs=round(dt, 1), state=f'still running after {win} s')

    def interrupt(self):
        """Ctrl+C the running command; escalate to TERM/KILL of the foreground process group."""
        notes = []
        for sig, label in ((None, 'Ctrl+C'), (None, 'Ctrl+C again'), (signal.SIGTERM, 'SIGTERM'), (signal.SIGKILL, 'SIGKILL')):
            if sig is None:
                self.p.sendcontrol('c')
            else:
                try:
                    os.killpg(os.tcgetpgrp(self.p.child_fd), sig)
                except OSError:
                    pass
            notes.append(label)
            i = self.p.expect([PROMPT, pexpect.TIMEOUT, pexpect.EOF], timeout=12)
            if i == 0:
                self.busy = None
                return self.p.before, int(self.p.match.group(1)), notes
        self.busy = None
        return '', None, notes

    def close(self):
        sid = self.p.pid
        if self.busy:
            self.interrupt()
        try:
            self.p.sendline('exit')
            self.p.expect(pexpect.EOF, timeout=5)
        except Exception:
            pass
        self.p.close(force=True)
        kill_session(sid)


def kill_session(sid):
    """Kill every process still in the terminal's session (nodes started from it)."""
    for p in os.listdir('/proc'):
        if p.isdigit():
            try:
                if os.getsid(int(p)) == sid:
                    os.kill(int(p), signal.SIGKILL)
            except (OSError, ProcessLookupError):
                pass


def clean(s, home):
    s = ANSI.sub('', s or '').replace('\r\n', '\n').replace('\r', '\n')
    return s.replace(home, SITE_HOME)


def domain_leftovers():
    left = []
    for p in os.listdir('/proc'):
        if not p.isdigit() or int(p) == os.getpid():
            continue
        try:
            env = open(f'/proc/{p}/environ', 'rb').read().split(b'\0')
            cmd = open(f'/proc/{p}/cmdline', 'rb').read().replace(b'\0', b' ').decode(errors='replace')
        except OSError:
            continue
        if f'ROS_DOMAIN_ID={DOMAIN}'.encode() in env and 'ros2-daemon' not in cmd and 'Xvfb' not in cmd:
            left.append((int(p), cmd[:120]))
    return left


def seed_home(block, home):
    if os.path.exists(home):
        shutil.rmtree(home)
    os.makedirs(home)
    for path, node in sorted(block['files'].items()):
        rel = os.path.relpath(path, SITE_HOME)
        dst = os.path.join(home, rel) if rel != '.' else home
        if rel in ('.bashrc', '.profile'):
            continue
        if node.get('d'):
            os.makedirs(dst, exist_ok=True)
        else:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            with open(dst, 'w') as f:
                f.write(node.get('content') or '')
            mode = node.get('mode', 'rw-r--r--')
            bits = sum(1 << (8 - i) for i, ch in enumerate(mode[:9]) if ch != '-')
            os.chmod(dst, bits)
    shutil.copy('/etc/skel/.bashrc', os.path.join(home, '.bashrc'))
    shutil.copy('/etc/skel/.profile', os.path.join(home, '.profile'))
    if block['sourced']:
        with open(os.path.join(home, '.bashrc'), 'a') as f:
            f.write('source /opt/ros/jazzy/setup.bash\n')


def base_env(home):
    return {
        'HOME': home, 'USER': os.environ.get('USER', 'prasad'), 'LOGNAME': os.environ.get('USER', 'prasad'),
        'SHELL': '/bin/bash', 'PATH': '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        'LANG': 'en_US.UTF-8', 'TERM': 'xterm-256color', 'DISPLAY': ':52', 'ROS_DOMAIN_ID': DOMAIN,
        'GZ_PARTITION': 'lessons52', 'XDG_RUNTIME_DIR': os.environ.get('XDG_RUNTIME_DIR', '/tmp'),
        'HISTFILE': os.path.join(home, '.bash_history'),
    }


def run_block(block):
    lid, tn = block['lesson'], block['term']
    home = os.path.join(SCRATCH, f'{lid}_t{tn}')
    seed_home(block, home)
    env = base_env(home)
    cwd = block['cwd'].replace(SITE_HOME, home, 1)
    rec = dict(lesson=lid, term=tn, title=block['title'], sourced=block['sourced'], running=block['running'],
               start=block['start'], scratch_home=home, home_shown_as=SITE_HOME, started=time.strftime('%Y-%m-%dT%H:%M:%S%z'),
               steps=[], pre=[], notes=[])
    pre_terms = []
    for name in block['running']:
        t = Term(len(pre_terms) + 100, home, env, home)
        # the running node's own terminal: ROS sourced as in the lesson's other terminals
        if not block['sourced']:
            t.p.sendline('source /opt/ros/jazzy/setup.bash')
            t.p.expect(PROMPT, timeout=30)
        r = t.run(RUNNING_CMD[name], 4)
        rec['pre'].append(dict(name=name, cmd=RUNNING_CMD[name], out=clean(r['out'], home), state=r['state']))
        pre_terms.append(t)
    if pre_terms:
        time.sleep(2)
    terms = [Term(1, home, env, cwd)]
    cur = terms[0]
    for k, task in enumerate(block['tasks']):
        sols = task['sol'] if isinstance(task['sol'], list) else [task['sol']]
        for s in sols:
            step = dict(task=k + 1, term=cur.n)
            if isinstance(s, dict) and s.get('newTerminal'):
                cur = Term(len(terms) + 1, home, env, home)
                terms.append(cur)
                step.update(kind='newTerminal', term=cur.n, status='RAN')
            elif isinstance(s, dict) and 'nano' in s:
                d = cur.cwd() or home
                p = s['nano'].replace('~', home, 1) if s['nano'].startswith('~') else os.path.join(d, s['nano'])
                old, new = (s.get('replace') or ['', ''])
                try:
                    txt = open(p).read() if os.path.exists(p) else ''
                except OSError:
                    txt = ''
                if old == '' or old in txt:
                    txt = txt.replace(old, new, 1) if old else new + txt
                    os.makedirs(os.path.dirname(p), exist_ok=True)
                    open(p, 'w').write(txt)
                    step.update(kind='nano', file=clean(p, home), status='RAN', out='(edited like nano: first occurrence replaced)')
                else:
                    step.update(kind='nano', file=clean(p, home), status='FAILED', out='(text to replace not found in the real file)')
            elif isinstance(s, dict):
                step.update(kind='gui', action=s, status='PENDING', reason='RViz GUI click/drag, not a typed command (covered by the RViz baseline D)')
            elif FORBIDDEN.search(s):
                step.update(kind='cmd', cmd=s, status='PENDING', reason='needs sudo/apt (run rules: never sudo or apt on this machine)')
            else:
                step.update(kind='cmd', cmd=s)
                if cur.busy:
                    out, code, how = cur.interrupt()
                    rec['steps'].append(dict(task=k + 1, term=cur.n, kind='interrupt', of=cur_cmd_of(rec, cur.n), how=how,
                                             out=clean(out, home), exit=code, status='RAN'))
                for t in terms + pre_terms:
                    if t is not cur:
                        t.drain()
                r = cur.run(s, window(s))
                step.update(out=clean(r['out'], home), exit=r['exit'], secs=r['secs'], state=r['state'], status='RAN',
                            cwd_after=clean(cur.cwd() or '', home))
                time.sleep(0.3)
                others = {}
                for t in terms + pre_terms:
                    if t is not cur:
                        o = clean(t.drain(), home)
                        if o.strip():
                            others[str(t.n)] = o
                if others:
                    step['other_terminals'] = others
            rec['steps'].append(step)
    for t in terms:
        if t.busy:
            was = t.busy
            out, code, how = t.interrupt()
            rec['steps'].append(dict(term=t.n, kind='interrupt-at-end', of=was, how=how, out=clean(out, home), exit=code, status='RAN'))
    for t in pre_terms:
        o = clean(t.drain(), home)
        rec['notes'].append(f'pre-running terminal {t.n} output during block: {o[-2000:]}')
    for t in terms + pre_terms:
        t.close()
    time.sleep(1)
    left = domain_leftovers()
    if left:
        for pid, _ in left:
            try:
                os.kill(pid, signal.SIGKILL)
            except OSError:
                pass
        rec['notes'].append(f'leftover processes killed after the block: {left}')
    rec['finished'] = time.strftime('%Y-%m-%dT%H:%M:%S%z')
    return rec


def cur_cmd_of(rec, n):
    for s in reversed(rec['steps']):
        if s.get('term') == n and s.get('kind') == 'cmd' and s.get('status') == 'RAN':
            return s.get('cmd')
    return None


def write(rec):
    d = os.path.join(OUT_ROOT, rec['lesson'])
    os.makedirs(d, exist_ok=True)
    base = os.path.join(d, f"term{rec['term']}")
    with open(base + '.json', 'w') as f:
        json.dump(rec, f, indent=1)
    with open(base + '_runner.log', 'w') as f:
        f.write(f"# REAL Ubuntu 24.04 + ROS 2 Jazzy, bash on a pty, ROS_DOMAIN_ID={DOMAIN}. Lesson {rec['lesson']} terminal {rec['term']}: {rec['title']}\n")
        f.write(f"# scratch HOME {rec['scratch_home']} shown as {SITE_HOME}; sourced={rec['sourced']} running={rec['running']} start={rec['start']}\n")
        for p in rec['pre']:
            f.write(f"## [pre-running terminal] $ {p['cmd']}  ({p['state']})\n{p['out']}\n")
        for s in rec['steps']:
            if s['kind'] == 'cmd':
                head = f"## [term {s['term']}] $ {s['cmd']}"
                if s['status'] == 'PENDING':
                    f.write(f"{head}\nPENDING: {s['reason']}\n")
                    continue
                f.write(f"{head}   (exit={s['exit']}, {s['secs']} s, {s['state']}, cwd={s.get('cwd_after')})\n{s['out']}\n")
                for n, o in (s.get('other_terminals') or {}).items():
                    f.write(f"### output meanwhile in terminal {n}:\n{o}\n")
            elif s['kind'].startswith('interrupt'):
                f.write(f"## [term {s['term']}] {'/'.join(s['how'])} to stop: {s['of']}  (exit={s['exit']})\n{s['out']}\n")
            elif s['kind'] == 'newTerminal':
                f.write(f"## [new terminal {s['term']}]\n")
            elif s['kind'] == 'nano':
                f.write(f"## [term {s['term']}] nano {s['file']}: {s['status']} {s['out']}\n")
            else:
                f.write(f"## [term {s['term']}] GUI {json.dumps(s['action'])}: PENDING {s['reason']}\n")
        for n in rec['notes']:
            f.write(f"# note: {n}\n")


def rewrite(paths):
    """Re-derive 'of' for interrupt steps (last command that RAN in that terminal) and rewrite the _runner.log."""
    for p in paths:
        rec = json.load(open(p))
        for i, s in enumerate(rec['steps']):
            if s.get('kind') == 'interrupt':
                s['of'] = cur_cmd_of(dict(steps=rec['steps'][:i]), s['term'])
        write(rec)


def main():
    if sys.argv[1] == '--rewrite':
        return rewrite(sys.argv[2:])
    blocks = json.load(open(sys.argv[1]))
    only = set(sys.argv[2:])
    # A ros2 daemon in its own session, started once: a daemon spawned by a block's first ros2 command would be
    # killed with that block's terminals, and every block would then begin with a cold daemon (empty node list).
    denv = dict(os.environ, ROS_DOMAIN_ID=DOMAIN)
    subprocess.run(['bash', '-c', 'source /opt/ros/jazzy/setup.bash && ros2 daemon start'], env=denv,
                   start_new_session=True, check=False)
    for b in blocks:
        if only and b['lesson'] not in only and f"{b['lesson']}#{b['term']}" not in only:
            continue
        t0 = time.time()
        try:
            rec = run_block(b)
        except Exception as e:   # record and go on: one broken block must not stop the run
            rec = dict(lesson=b['lesson'], term=b['term'], title=b['title'], sourced=b['sourced'], running=b['running'],
                       start=b['start'], scratch_home='', steps=[], pre=[], notes=[f'RUNNER ERROR: {e!r}'])
        write(rec)
        print(f"{b['lesson']}#{b['term']}: {len(rec['steps'])} steps, {time.time() - t0:.0f} s", flush=True)


if __name__ == '__main__':
    main()
