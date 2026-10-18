# ROS2Lab launch runtime.
#
# Runs REAL ROS 2 Jazzy launch files (Python, XML, YAML) with the REAL ros2/launch, launch_ros and ros2launch
# libraries, but no process is started: every process the launch system would start is reported to the host (the
# website's simulator, through `HOST`), which runs its own model of that program and decides what it prints and when
# it exits. Everything `ros2 launch` itself prints (log dir, "process started with pid", "process has finished
# cleanly", "process has died", SIGINT/SIGTERM escalation, errors) is printed by the real libraries.
#
# What is replaced (and why):
#   * launch.actions.execute_local.async_execute_process -> _fake_execute_process (no subprocesses in a browser);
#     the executable is resolved like execve() would (PATH of the process env, exec bit) so a missing program fails
#     with the same FileNotFoundError text.
#   * launch.launch_service.AsyncSafeSignalManager -> host signals (Ctrl+C in the website terminal).
#   * Command substitution: `xacro ...` runs the real xacro in-process; any other program fails exactly like a
#     missing executable ("file not found: [Errno 2] No such file or directory: 'prog'").
#   * launch_ros ROSAdapter (no executor thread), LoadComposableNodes (the load_node service call is answered by the
#     host), lifecycle ChangeState (answered by the host; by default the transition succeeds).
#   * ros2launch's launch_a_launch_file -> the same code awaiting LaunchService.run_async() (no blocking loop).
import warnings
# compile-time SyntaxWarnings of Python 3.14 about older third-party sources (Ubuntu 24.04 runs Python 3.12)
warnings.filterwarnings("ignore", category=SyntaxWarning)
import asyncio  # noqa: E402
import contextvars  # noqa: E402
import errno
import inspect
import io
import itertools
import json
import os
import shlex
import socket
import sys
import time

# ------------------------------------------------------------------------------------------------ output plumbing
HOST = None          # set by launch-worker.js (or a test): see the Host protocol at the end of this file
_job_var = contextvars.ContextVar("r2l_job", default=None)
_capture_var = contextvars.ContextVar("r2l_capture", default=None)


class _Stream(io.TextIOBase):
    """sys.stdout / sys.stderr: routes text to the job whose asyncio task is printing (line buffered)."""

    def __init__(self, stream):
        self._stream = stream
        self._buf = {}

    def writable(self):
        return True

    def isatty(self):
        return False

    @property
    def encoding(self):
        return "utf-8"

    def write(self, s):
        if not isinstance(s, str):
            s = str(s)
        cap = _capture_var.get()
        if cap is not None:
            cap[self._stream].append(s)
            return len(s)
        job = _job_var.get()
        key = job.id if job else None
        b = self._buf.get(key, "") + s
        i = b.rfind("\n")
        if i >= 0:
            _emit(job, self._stream, b[:i + 1])
            b = b[i + 1:]
        self._buf[key] = b
        return len(s)

    def flush(self):
        job = _job_var.get()
        key = job.id if job else None
        b = self._buf.pop(key, "")
        if b:
            _emit(job, self._stream, b)


# Pyodide numbers errno like WASI (ENOENT is 44); print what Linux prints ("[Errno 2] No such file or directory")
_LINUX_ERRNO = {"Operation not permitted": 1, "No such file or directory": 2, "Exec format error": 8,
                "Bad file descriptor": 9, "Permission denied": 13, "File exists": 17, "Not a directory": 20,
                "Is a directory": 21, "Invalid argument": 22, "Directory not empty": 39,
                "Function not implemented": 38, "Read-only file system": 30, "No space left on device": 28}
_ERRNO_RE = __import__("re").compile(r"\[Errno \d+\] (" + "|".join(_LINUX_ERRNO) + ")")


def linux_errno(text):
    if "[Errno " not in text:
        return text
    return _ERRNO_RE.sub(lambda m: "[Errno {}] {}".format(_LINUX_ERRNO[m.group(1)], m.group(1)), text)


def _emit(job, stream, text):
    text = linux_errno(text)
    if HOST is not None:
        HOST.emit(job.id if job else 0, stream, text)
    else:
        (sys.__stdout__ if stream == "out" else sys.__stderr__).write(text)


class _TtyStdin(io.TextIOBase):
    """`ros2 launch` decides --noninteractive from sys.stdin.isatty(): the website terminal is a tty."""

    def readable(self):
        return True

    def isatty(self):
        job = _job_var.get()
        return bool(job.tty) if job else False

    def read(self, *a):
        return ""

    def readline(self, *a):
        return ""


sys.stdout = _Stream("out")
sys.stderr = _Stream("err")
sys.stdin = _TtyStdin()

# the launch process identity (log dir name, hidden launch_ros_<pid> node)
socket.gethostname = lambda: os.environ.get("HOSTNAME") or os.environ.get("R2L_HOSTNAME") or "ros2lab"
os.getpid = lambda: (_job_var.get().pid if _job_var.get() else 4242)

import r2l_stubs  # noqa: E402,F401  (rclpy, lifecycle_msgs, composition_interfaces, lxml fallback)
import launch  # noqa: E402
import launch.actions.execute_local as _el  # noqa: E402
import launch.descriptions.executable as _exe_desc  # noqa: E402
import launch.launch_service as _ls  # noqa: E402
import launch.logging  # noqa: E402
import launch.substitutions.command as _cmd_sub  # noqa: E402


# ------------------------------------------------------------------------------------------------ jobs
class Job:
    def __init__(self, job_id, *, pid, env, cwd, tty=True, host_signals=False):
        self.id = job_id
        self.pid = pid                       # pid of the `ros2 launch` process itself
        self._pids = itertools.count(pid + 1)
        self.env = dict(env)
        self.cwd = cwd
        self.tty = tty
        self.host_signals = host_signals     # True: the host decides how a process reacts to SIGINT/SIGTERM
        self.procs = {}                      # pid -> _FakeProto
        self.node_procs = {}                 # '/ns/node' -> pid (for LoadComposableNodes)
        self.signal_handlers = {}            # signum -> handler registered by LaunchService
        self.service = None
        self.early_signals = set()           # signals that arrived before LaunchService registered its handlers

    def next_pid(self):
        return next(self._pids)


JOBS = {}
_UTIL_JOB_IDS = itertools.count(1_000_000)


def _current_job():
    job = _job_var.get()
    if job is None:
        raise RuntimeError("no launch job in this context")
    return job


# ------------------------------------------------------------------------------------------------ fake processes
class _FakeTransport:
    def __init__(self, job, pid):
        self._job, self._pid = job, pid

    def get_pid(self):
        return self._pid

    def send_signal(self, sig):
        _deliver_signal(self._job, self._pid, int(sig))

    def terminate(self):
        self.send_signal(15)

    def kill(self):
        self.send_signal(9)

    def close(self):
        pass

    def get_returncode(self):
        p = self._job.procs.get(self._pid)
        return p.rc if p else None

    def get_pipe_transport(self, fd):
        return None


class _FakeProto:
    def __init__(self, inner, pid, info, job):
        self.inner, self.pid, self.rc, self.info, self.job = inner, pid, None, info, job
        self.complete = asyncio.get_event_loop().create_future()
        self.started_at = time.monotonic()

    @property
    def running(self):
        return not self.complete.done()

    def finish(self, rc=0):
        if not self.complete.done():
            self.rc = rc
            self.complete.set_result(rc)
            if HOST is not None and hasattr(HOST, "exited"):   # whatever the cause: the host stops its model
                HOST.exited(self.job.id, self.pid, rc)

    def out(self, text):
        self.inner.on_stdout_received(text.encode())

    def err(self, text):
        self.inner.on_stderr_received(text.encode())


def _exec_error(prog, env):
    """None if execve() would find `prog`, else the OSError subprocess raises (Linux errno values)."""
    try:
        _resolve_executable(prog, env)
        return None
    except PermissionError as e:
        return PermissionError(13, "Permission denied", e.filename)
    except FileNotFoundError:
        return FileNotFoundError(2, "No such file or directory", prog)


def _resolve_executable(prog, env):
    """Where execve() would find `prog` (FileNotFoundError / PermissionError like subprocess)."""
    if "/" in prog:
        cands = [prog]
    else:
        path = (env or os.environ).get("PATH", os.defpath)
        cands = [os.path.join(d or ".", prog) for d in path.split(os.pathsep)]
    denied = None
    for c in cands:
        if os.path.isfile(c):
            if os.access(c, os.X_OK):
                return c
            denied = c
    if denied:
        raise PermissionError(errno.EACCES, os.strerror(errno.EACCES), prog if "/" not in prog else denied)
    raise FileNotFoundError(errno.ENOENT, os.strerror(errno.ENOENT), prog)


def _ros_info(action, cmd, context):
    """Structured launch_ros details for the host (it can also parse cmd)."""
    try:
        from launch_ros.actions import Node
        from launch.utilities import normalize_to_list_of_substitutions, perform_substitutions
    except Exception:  # pragma: no cover
        return None
    if not isinstance(action, Node):
        return None

    def text(v):
        if v is None or isinstance(v, str):
            return v
        try:
            return perform_substitutions(context, normalize_to_list_of_substitutions(v))
        except Exception:
            return str(v)

    d = {}
    for key, attr in (("package", "node_package"), ("executable", "node_executable")):
        try:
            d[key] = text(getattr(action, attr))
        except Exception:
            pass
    try:
        d["name"] = text(action.node_name)
    except Exception:
        d["name"] = None
    try:
        d["namespace"] = text(action.expanded_node_namespace)
    except Exception:
        d["namespace"] = None
    for k in ("name", "namespace"):
        if d.get(k) and "unspecified>" in d[k]:
            d[k] = None
    try:
        from launch_ros.actions import LifecycleNode, ComposableNodeContainer
        d["lifecycle"] = isinstance(action, LifecycleNode)
        d["container"] = isinstance(action, ComposableNodeContainer)
    except Exception:
        pass
    # node name as `ros2 node list` would show it, from the __node/__ns remaps in cmd (works for every Node)
    name, ns = None, None
    for i, c in enumerate(cmd):
        if c == "-r" and i + 1 < len(cmd):
            if cmd[i + 1].startswith("__node:="):
                name = cmd[i + 1].split(":=", 1)[1]
            elif cmd[i + 1].startswith("__ns:="):
                ns = cmd[i + 1].split(":=", 1)[1]
    if name is None and d.get("name") and not str(d["name"]).startswith("<"):
        name = str(d["name"]).rstrip("/").rsplit("/", 1)[-1]
    if name:
        d["fqn"] = _fqn(ns, name)
    return d


def _fqn(ns, name):
    ns = (ns or "/").strip("/")
    return "/" + (ns + "/" if ns else "") + name.strip("/")


def _node_params(info):
    """The parameters this node gets, as rcl would resolve them: its --params-file sections that match the node
    (/**, /**/name, its fully qualified name), then -p name:=value overrides. Plain JSON for the host."""
    import yaml
    ros = info.get("ros") or {}
    fqn = ros.get("fqn") or ""
    name = fqn.rsplit("/", 1)[-1] if fqn else (ros.get("name") or "")
    keys = {"/**", "**", "/**/" + name, fqn, fqn.lstrip("/"), name}
    out = {}
    cmd = info["cmd"]
    for i, c in enumerate(cmd):
        if c == "--params-file" and i + 1 < len(cmd):
            text = info["files"].get(cmd[i + 1])
            if text is None:
                continue
            try:   # launch_ros dumps Python tuples as !!python/tuple (rcl reads them as lists)
                d = yaml.load(text, Loader=getattr(yaml, "FullLoader", yaml.SafeLoader))
            except Exception:
                continue
            if not isinstance(d, dict):
                continue
            for k, body in d.items():
                if isinstance(body, dict) and isinstance(body.get("ros__parameters"), dict) and str(k) in keys:
                    out.update(body["ros__parameters"])
        elif c == "-p" and i + 1 < len(cmd) and ":=" in cmd[i + 1]:
            k, v = cmd[i + 1].split(":=", 1)
            try:
                out[k] = yaml.safe_load(v)
            except Exception:
                out[k] = v
    return out


async def _fake_execute_process(protocol_class, cmd, cwd=None, env=None, shell=False, emulate_tty=False,
                                stderr_to_stdout=False):
    job = _current_job()
    cmd = [str(c) for c in cmd]
    # the ExecuteLocal action and its event args are in the closure of the protocol factory
    nl = inspect.getclosurevars(protocol_class).nonlocals
    action, ev_args = nl.get("self"), nl.get("process_event_args") or {}
    # A real subprocess takes a few loop turns to start. When the launch fails while its entities are still being
    # visited (e.g. KeyError 'TURTLEBOT3_MODEL' in a later include), ros2 launch logs the error and shuts down before
    # any process is started: no "process started" line (parity/fixtures/tb3_burger/sensors/errors/no_tb3_model).
    for _ in range(3):
        await asyncio.sleep(0)
    context = nl.get("context")
    if context is not None and context.is_shutdown:
        raise asyncio.CancelledError()
    err = _exec_error("/bin/sh" if shell else cmd[0], env)
    if err is not None:
        raise err                          # like asyncio.create_subprocess_exec / execve()
    pid = job.next_pid()
    inner = protocol_class()
    info = {"pid": pid, "cmd": cmd, "cwd": cwd or job.cwd, "env": dict(env) if env is not None else dict(os.environ),
            "name": ev_args.get("name"), "shell": bool(shell), "files": {}}
    # parameter files (--params-file) and any other file the launch generated at run time (/tmp/..., e.g. a
    # RewrittenYaml result passed as `-p config_file:=/tmp/tmpab12`): the host cannot read this file system
    for i, c in enumerate(cmd):
        p = None
        if c == "--params-file" and i + 1 < len(cmd):
            p = cmd[i + 1]
        else:
            v = c.split(":=", 1)[-1]
            if v.startswith("/tmp/") and os.path.isfile(v):
                p = v
        if p and p not in info["files"]:
            try:
                if os.path.getsize(p) < 4_000_000:
                    with open(p) as f:
                        info["files"][p] = f.read()
            except (OSError, UnicodeDecodeError):
                pass
    ros = _ros_info(action, cmd, nl.get("context"))
    if ros:
        info["ros"] = ros
    try:
        info["params"] = _node_params(info)
    except Exception:  # never break a launch over this convenience
        info["params"] = {}
    if ros:
        if ros.get("fqn"):
            job.node_procs[ros["fqn"]] = pid
    proto = _FakeProto(inner, pid, info, job)
    job.procs[pid] = proto
    transport = _FakeTransport(job, pid)
    inner.connection_made(transport)   # prints "process started with pid [N]"
    if HOST is not None:
        payload = json.dumps(info, default=str)
        asyncio.get_event_loop().call_soon(lambda: HOST.started(job.id, payload))
    return transport, proto


_el.async_execute_process = _fake_execute_process


def _deliver_signal(job, pid, sig):
    proto = job.procs.get(pid)
    if not proto or not proto.running:
        return
    if sig == 9:                       # SIGKILL cannot be handled
        proto.finish(-9)
        if HOST is not None:
            HOST.signal(job.id, pid, 9)
        return
    if job.host_signals and HOST is not None:
        HOST.signal(job.id, pid, sig)  # the host's process model exits (job.exit) when it wants
        return
    # default: a ROS 2 program shuts down cleanly on SIGINT and dies on SIGTERM/SIGQUIT
    rc = 0 if sig == 2 else -sig
    asyncio.get_event_loop().call_later(0.05, lambda: proto.finish(rc))


# no OS signals in the browser: Ctrl+C in the website terminal calls the handlers LaunchService registered
class _HostSignalManager:
    def __init__(self, loop):
        self.loop = loop
        self.job = _job_var.get()

    def __enter__(self):
        return self

    def __exit__(self, *a):
        if self.job:
            self.job.signal_handlers.clear()
        return False

    def handle(self, signum, handler):
        if self.job:
            self.job.signal_handlers[int(signum)] = handler
            if int(signum) in self.job.early_signals:   # Ctrl+C pressed before the launch service was running
                self.job.early_signals.discard(int(signum))
                self.loop.call_soon(handler, int(signum))


_ls.AsyncSafeSignalManager = _HostSignalManager


# ------------------------------------------------------------------------------------------------ Command / xacro
class _Completed:
    def __init__(self, args, returncode, stdout, stderr):
        self.args, self.returncode, self.stdout, self.stderr = args, returncode, stdout, stderr


def run_xacro(argv):
    """The real xacro CLI, in-process. Returns (returncode, stdout, stderr)."""
    import xacro
    cap = {"out": [], "err": []}
    token = _capture_var.set(cap)
    old_argv = sys.argv
    sys.argv = ["xacro"] + list(argv)
    rc = 0
    try:
        _reset_xacro(xacro)
        xacro.main()
    except SystemExit as e:
        rc = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
        if isinstance(e.code, str):
            cap["err"].append(e.code + "\n")
    except Exception as e:  # verbosity > 1 re-raises
        import traceback
        cap["err"].append(traceback.format_exc())
        rc = 1
    finally:
        sys.argv = old_argv
        _capture_var.reset(token)
    return rc, "".join(cap["out"]), "".join(cap["err"])


def _reset_xacro(xacro):
    # xacro keeps per-run state in module globals; a fresh `xacro` process starts with these values
    try:
        xacro.all_includes = []
        xacro.filestack = []
        xacro.verbosity = 1
        xacro.substitution_args_context = {}
        if hasattr(xacro, "init_stacks"):
            xacro.init_stacks(None)
    except Exception:
        pass


class _SubprocessShim:
    """Stands for `subprocess` inside launch.substitutions.command."""
    PIPE = -1
    STDOUT = -2

    @staticmethod
    def run(command, stdout=None, stderr=None, universal_newlines=True, **kw):
        if isinstance(command, str):
            command = shlex.split(command)
        if not command:
            raise FileNotFoundError(2, "No such file or directory", "")
        err = _exec_error(command[0], os.environ)
        if err is not None:
            raise err
        path = _resolve_executable(command[0], os.environ)
        if os.path.basename(path) == "xacro":
            rc, out, err = run_xacro(command[1:])
        else:
            # the website runs no programs: behave exactly like a missing executable
            raise FileNotFoundError(2, "No such file or directory", command[0])
        if stderr == _SubprocessShim.STDOUT:
            out, err = out + err, None
        return _Completed(command, rc, out, err if stderr == _SubprocessShim.PIPE else None)


_cmd_sub.subprocess = _SubprocessShim


# ------------------------------------------------------------------------------------------------ launch_ros patches
def _patch_launch_ros():
    import launch_ros.ros_adapters as ra

    def _start(self):
        if self._ROSAdapter__is_running:
            raise RuntimeError("Cannot start a ROS adapter that is already running")
        import rclpy
        self._ROSAdapter__ros_context = rclpy.Context()
        self._ROSAdapter__ros_node = rclpy.create_node("launch_ros_{}".format(os.getpid()))
        self._ROSAdapter__ros_executor = None
        self._ROSAdapter__is_running = True

    def _shutdown(self):
        if not self._ROSAdapter__is_running:
            raise RuntimeError("Cannot shutdown a ROS adapter that is not running")
        self._ROSAdapter__is_running = False

    ra.ROSAdapter.start = _start
    ra.ROSAdapter.shutdown = _shutdown

    # ---- LoadComposableNodes: the container's ~/_container/load_node service is answered by the host
    from launch_ros.actions import load_composable_nodes as lcn
    from launch_ros.actions.composable_node_container import ComposableNodeContainer
    from launch.utilities import is_a_subclass, normalize_to_list_of_substitutions, perform_substitutions
    from launch.some_substitutions_type import SomeSubstitutionsType_types_tuple
    from launch_ros.utilities import evaluate_parameters
    LCN = lcn.LoadComposableNodes

    def _execute(self, context):
        logger = self._LoadComposableNodes__logger
        target = self._LoadComposableNodes__target_container
        if is_a_subclass(target, ComposableNodeContainer):
            name = target.node_name
        elif isinstance(target, SomeSubstitutionsType_types_tuple):
            name = perform_substitutions(context, normalize_to_list_of_substitutions(target))
        else:
            logger.error("target container is neither a ComposableNodeContainer nor a SubstitutionType")
            return
        self._LoadComposableNodes__final_target_container_name = name
        requests = []
        for desc in self._LoadComposableNodes__composable_node_descriptions:
            req = lcn.get_composable_node_load_request(desc, context)
            if req is None:
                continue
            files = {}
            try:
                for p in evaluate_parameters(context, desc.parameters or []):
                    if not isinstance(p, dict):
                        with open(str(p)) as f:
                            files[str(p)] = f.read()
            except Exception:
                pass
            autostart = bool(getattr(desc, "node_autostart", False))
            requests.append((req, files, autostart))
        if requests:
            job = _current_job()
            context.add_completion_future(asyncio.ensure_future(_load_in_sequence(self, job, name, requests, context)))
        return None

    LCN.execute = _execute

    # ---- lifecycle: ChangeState requests go to the host
    from launch_ros.utilities import lifecycle_event_manager as lem
    from launch_ros.events.lifecycle import ChangeState

    def _on_change_state_event(self, context):
        ev = context.locals.event
        if not ev.lifecycle_node_matcher(self._LifecycleEventManager__lifecycle_node):
            return None
        job = _current_job()
        context.add_completion_future(asyncio.ensure_future(
            _change_state(job, self, self._LifecycleEventManager__lifecycle_node, ev.transition_id, context)))
        return None

    lem.LifecycleEventManager._on_change_state_event = _on_change_state_event
    _patch_launch_ros.ChangeState = ChangeState


class _DoneFuture:
    def __init__(self, result):
        self._r = result

    def add_done_callback(self, cb):
        cb(self)

    def exception(self):
        return None

    def result(self):
        return self._r

    def cancel(self):
        return False


class _AnsweredClient:
    def __init__(self, srv_name, response):
        self.srv_name, self._response = srv_name, response

    def wait_for_service(self, timeout_sec=None):
        return True

    def call_async(self, request):
        return _DoneFuture(self._response)


async def _host_call(method, job, payload):
    if HOST is None or not hasattr(HOST, method):
        return None
    res = getattr(HOST, method)(job.id, json.dumps(payload, default=str))
    if inspect.isawaitable(res):
        res = await res
    if res is None:
        return None
    try:
        res = res.to_py() if hasattr(res, "to_py") else res
    except Exception:
        pass
    if isinstance(res, str):
        return json.loads(res) if res else None
    return res if isinstance(res, dict) else None


async def _wait_for_container(job, name, context):
    """The real action waits for <container>/_container/load_node; here: for the container process to be up."""
    fqn = "/" + name.strip("/")
    while not context.is_shutdown:
        pid = job.node_procs.get(fqn)
        if pid is None:
            return True                 # not started by this launch: the host decides
        proto = job.procs.get(pid)
        if proto and proto.running and time.monotonic() - proto.started_at >= 0.25:
            return True
        await asyncio.sleep(0.05)
    return False


async def _load_in_sequence(action, job, container, requests, context):
    from launch_ros.utilities import make_namespace_absolute
    logger = action._LoadComposableNodes__logger
    srv = "{}/_container/load_node".format(container)
    for req, files, autostart in requests:
        if not await _wait_for_container(job, container, context):
            logger.warning("Abandoning wait for the '{}' service, due to shutdown.".format(srv))
            return
        ns = req.node_namespace or "/"
        node = {
            "package": req.package_name, "plugin": req.plugin_name, "name": req.node_name or None,
            "namespace": ns, "remappings": list(req.remap_rules or []),
            "parameters": {p.name: p.value for p in (req.parameters or [])},
            "extra_arguments": {p.name: p.value for p in (req.extra_arguments or [])},
            "parameter_files": files, "autostart": autostart,
        }
        res = await _host_call("load_composable", job, {"container": container, "nodes": [node]}) or {}
        if isinstance(res.get("results"), list) and res["results"]:
            res = res["results"][0] or {}
        ok = bool(res.get("success", True))
        resp = r2l_stubs._LoadNodeResponse(
            success=ok, error_message=str(res.get("error_message", "")),
            full_node_name=res.get("full_node_name") or (_fqn(ns, req.node_name) if ok and req.node_name else ""),
            unique_id=res.get("unique_id", 0))
        action._LoadComposableNodes__rclpy_load_node_client = _AnsweredClient(srv, resp)
        action._load_node(req, context)          # real logging: "Loaded node '/x' in container '/c'"
        if autostart and resp.success:
            await _auto_lifecycle(job, resp.full_node_name, context)


_TRANSITIONS = {  # id -> (label, start state, intermediate state, goal state on success)
    1: ("configure", "unconfigured", "configuring", "inactive"),
    2: ("cleanup", "inactive", "cleaningup", "unconfigured"),
    3: ("activate", "inactive", "activating", "active"),
    4: ("deactivate", "active", "deactivating", "inactive"),
    5: ("shutdown", "unconfigured", "shuttingdown", "finalized"),
    6: ("shutdown", "inactive", "shuttingdown", "finalized"),
    7: ("shutdown", "active", "shuttingdown", "finalized"),
}


_SUCCESS_IDS = {1: 10, 2: 20, 3: 30, 4: 40, 5: 50, 6: 50, 7: 50}   # TRANSITION_ON_<X>_SUCCESS


def _transition_msg(label, tid, start, goal):
    from lifecycle_msgs.msg import TransitionEvent, Transition, State
    return TransitionEvent(timestamp=int(time.time() * 1e9), transition=Transition(id=tid, label=label),
                           start_state=State(label=start), goal_state=State(label=goal))


async def _change_state(job, manager, node_action, transition_id, context):
    from launch_ros.events.lifecycle import StateTransition
    label, start, mid, goal = _TRANSITIONS.get(int(transition_id), ("unknown", "unknown", "unknown", "unknown"))
    # like launch_ros, which waits for the node's change_state service: wait until its process has started (and the
    # host has been told, HOST.started is call_soon'ed) before asking the host for the transition
    fqn = _fqn("/", node_action.node_name)
    for _ in range(250):
        if fqn in job.node_procs or context.is_shutdown:
            break
        await asyncio.sleep(0.02)
    await asyncio.sleep(0)
    res = await _host_call("lifecycle", job, {"node": node_action.node_name, "transition": label,
                                              "transition_id": int(transition_id)}) or {}
    if not res.get("success", True):
        manager._LifecycleEventManager__logger.error("Failed to make transition '{}' for LifecycleNode '{}'".format(
            _patch_launch_ros.ChangeState.valid_transitions[int(transition_id)], node_action.node_name))
        return
    if res.get("events") is False:   # the host will publish the transition events itself (lifecycle_event)
        return
    for msg in (_transition_msg(label, int(transition_id), start, mid),
                _transition_msg("transition_success", _SUCCESS_IDS.get(int(transition_id), 97), mid, goal)):
        context.emit_event_sync(StateTransition(action=node_action, msg=msg))


async def _auto_lifecycle(job, node_name, context):
    for tid in (1, 3):
        label = _TRANSITIONS[tid][0]
        await _host_call("lifecycle", job, {"node": node_name, "transition": label, "transition_id": tid})


def lifecycle_event(job_id, node_name, transition, start, goal):
    """Host -> launch: a lifecycle node published a TransitionEvent (OnStateTransition handlers react)."""
    job = JOBS.get(job_id)
    if not job or not job.service:
        return False
    from launch_ros.events.lifecycle import StateTransition
    from launch_ros.actions import LifecycleNode
    ctx = job.service.context
    target = None
    for entity in _walk_entities(job):
        if isinstance(entity, LifecycleNode):
            try:
                if entity.node_name == node_name or _fqn("/", entity.node_name) == _fqn("/", node_name):
                    target = entity
                    break
            except Exception:
                pass
    if target is None:
        return False
    ctx.emit_event_sync(StateTransition(action=target, msg=_transition_msg(transition, 0, start, goal)))
    return True


def _walk_entities(job):
    for entity, _ in list(job.service._entity_future_pairs):
        yield entity


# ------------------------------------------------------------------------------------------------ ros2 CLI
async def _async_launch_a_launch_file(*, launch_file_path, launch_file_arguments, noninteractive=False, args=None,
                                      option_extensions={}, debug=False):
    """ros2launch.api.launch_a_launch_file, awaiting the service instead of blocking in loop.run_until_complete."""
    from ros2launch.api.api import parse_launch_arguments
    job = _current_job()
    if getattr(job, "sync_only", False):
        raise RuntimeError("this command starts a launch: run it as a launch job (launch-runtime.js launch())")
    for name in sorted(option_extensions.keys()):
        option_extensions[name].prestart(args)
    if args and args.launch_prefix:
        launch_file_arguments.append(f"launch-prefix:={args.launch_prefix}")
    if args and args.launch_prefix_filter:
        launch_file_arguments.append(f"launch-prefix-filter:={args.launch_prefix_filter}")
    launch_service = launch.LaunchService(argv=launch_file_arguments, noninteractive=noninteractive, debug=debug)
    job.service = launch_service
    parsed_launch_arguments = parse_launch_arguments(launch_file_arguments)
    launch_description = launch.LaunchDescription([
        launch.actions.IncludeLaunchDescription(
            launch.launch_description_sources.AnyLaunchDescriptionSource(launch_file_path),
            launch_arguments=parsed_launch_arguments,
        ),
    ])
    for name in sorted(option_extensions.keys()):
        launch_description = option_extensions[name].prelaunch(launch_description, args)[0]
    launch_service.include_launch_description(launch_description)
    ret = await launch_service.run_async()
    for name in sorted(option_extensions.keys()):
        option_extensions[name].postlaunch(ret, args)
    return ret


def _patch_ros2launch():
    import ros2launch.command.launch as cl
    cl.launch_a_launch_file = _async_launch_a_launch_file


def _print_traceback(exc):
    import traceback
    te = traceback.TracebackException.from_exception(exc)
    for t in [te] + [x for x in (te.__cause__, te.__context__) if x]:   # hide this module's frames
        t.stack = traceback.StackSummary.from_list([f for f in t.stack if not f.filename.endswith("r2l_launch.py")])
    sys.stdout.flush()
    sys.stderr.write("".join(te.format()))
    sys.stderr.flush()


async def ros2(argv):
    """`ros2 <argv...>` with the real ros2cli argument parsing; returns the process exit code."""
    from ros2cli.cli import main as cli_main
    rc = None
    sys.argv = ["/opt/ros/jazzy/bin/ros2"] + list(argv)   # nested ros2cli parsers read sys.argv
    try:
        rc = cli_main(script_name="ros2", argv=list(argv))
        if inspect.isawaitable(rc):
            try:
                rc = await rc
            except KeyboardInterrupt:
                rc = 2
            except RuntimeError as e:
                rc = str(e)
    except SystemExit as e:             # argparse errors (exit 2) and --help (exit 0)
        rc = e.code
    except KeyboardInterrupt:
        rc = 2
    except Exception as e:              # uncaught in ros2cli: python prints the traceback and exits with 1
        _print_traceback(e)
        rc = 1
    sys.stdout.flush()
    if rc is None:
        return 0
    if isinstance(rc, int):
        return rc
    print(rc, file=sys.stderr)          # what sys.exit("message") prints
    sys.stderr.flush()
    return 1


# ------------------------------------------------------------------------------------------------ environment
BASE_SYS_PATH = list(sys.path)
PY_SUBDIRS = ("python", "lib/python3.12/site-packages", "local/lib/python3.12/dist-packages")


def _apply_env(env, cwd):
    os.environ.clear()
    os.environ.update({str(k): str(v) for k, v in env.items()})
    os.environ.setdefault("PATH", "/opt/ros/jazzy/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin")
    os.environ.setdefault("HOME", "/home/student")
    # like sourcing setup.bash: python modules of every prefix in AMENT_PREFIX_PATH (+ PYTHONPATH) are importable
    extra = [p for p in os.environ.get("PYTHONPATH", "").split(os.pathsep) if p]
    for prefix in os.environ.get("AMENT_PREFIX_PATH", "").split(os.pathsep):
        for sub in PY_SUBDIRS:
            d = os.path.join(prefix, sub)
            if prefix and os.path.isdir(d):
                extra.append(d)
    sys.path[:] = extra + [p for p in BASE_SYS_PATH if p not in extra]
    import importlib
    importlib.invalidate_caches()
    try:
        os.makedirs(os.environ["HOME"], exist_ok=True)
        os.chdir(cwd or os.environ["HOME"])
    except OSError:
        os.chdir("/")


def _fresh_launch_state():
    # a new `ros2 launch` process starts with fresh module globals
    _exe_desc._executable_process_counter = 0
    launch.logging.reset()


# ------------------------------------------------------------------------------------------------ host API
async def run_job(job_id, argv, env, cwd=None, pid=4300, tty=True, host_signals=False):
    """Run one command (e.g. ["ros2", "launch", "pkg", "file.launch.py", "x:=1"]) as a job; returns its exit code."""
    job = JOBS.get(job_id) or Job(job_id, pid=pid, env=env, cwd=cwd, tty=tty, host_signals=host_signals)
    JOBS[job_id] = job
    _job_var.set(job)
    try:
        _apply_env(env, cwd)
        _fresh_launch_state()
        if argv and argv[0] == "ros2":
            code = await ros2(argv[1:])
        elif argv and os.path.basename(argv[0]) == "xacro":
            rc, out, err = run_xacro(argv[1:])
            if out:
                print(out, end="")
            if err:
                print(err, end="", file=sys.stderr)
            code = rc
        else:
            print("{}: command not found".format(argv[0] if argv else ""), file=sys.stderr)
            code = 127
    except BaseException as e:  # never leave the job hanging
        import traceback
        traceback.print_exc()
        code = 1
    finally:
        sys.stdout.flush()
        sys.stderr.flush()
        for proto in job.procs.values():   # orphans: tell the host they are gone with the launch
            if proto.running:
                proto.finish(-9)
        _drop_log_dir()
    return code


def _drop_log_dir():
    """The ~/.ros/log/<run> directory only lives in this worker's memory: free it when the launch ends."""
    try:
        import shutil
        d = launch.logging.launch_config._log_dir
        if d and os.path.isdir(d):
            shutil.rmtree(d, ignore_errors=True)
            latest = os.path.join(os.path.dirname(d), "latest")
            if os.path.islink(latest):
                os.unlink(latest)
    except Exception:
        pass


def start_job(job_id, argv, env, cwd=None, pid=4300, tty=True, host_signals=False):
    """Schedule run_job in its own task (own contextvars copy); HOST.done(job_id, code) when it ends."""
    ctx = contextvars.copy_context()
    cwd = _opt(cwd)
    # registered now, so signals / writes that arrive before the task first runs find the job
    JOBS[job_id] = Job(job_id, pid=pid, env=env, cwd=cwd, tty=tty, host_signals=host_signals)

    async def runner():
        code = await run_job(job_id, list(argv), dict(env), cwd, pid, tty, host_signals)
        JOBS.pop(job_id, None)
        _TASKS.discard(task)
        if HOST is not None:
            HOST.done(job_id, code)
        return code

    task = ctx.run(asyncio.get_event_loop().create_task, runner())
    _TASKS.add(task)          # asyncio keeps only weak references to tasks
    return task


_TASKS = set()


def write(job_id, pid, text, stream="out"):
    job = JOBS.get(job_id)
    p = job.procs.get(pid) if job else None
    if p and p.running:
        token = _job_var.set(job)
        try:
            (p.out if stream == "out" else p.err)(text)
        finally:
            _job_var.reset(token)
        return True
    return False


def exit_process(job_id, pid, rc=0):
    job = JOBS.get(job_id)
    p = job.procs.get(pid) if job else None
    if p and p.running:
        p.finish(int(rc))
        return True
    return False


def signal_job(job_id, signum=2):
    """Ctrl+C (2) / Ctrl+\\ (3) in the terminal: the launch process and its whole foreground group get the signal."""
    job = JOBS.get(job_id)
    if not job:
        return False
    token = _job_var.set(job)
    try:
        h = job.signal_handlers.get(int(signum))
        if h:
            h(int(signum))
        else:
            job.early_signals.add(int(signum))
        for pid, proto in list(job.procs.items()):
            if proto.running:
                _deliver_signal(job, pid, int(signum))
    finally:
        _job_var.reset(token)
    return True


def ctrl_c(job_id):
    return signal_job(job_id, 2)


def run_sync(argv, env=None):
    """Synchronous one-shot commands for the host (ros2 launch -s / -p, ros2 pkg ..., xacro): (code, out, err).
    The launch description is loaded synchronously by these commands, so nothing else runs meanwhile."""
    job = Job(next(_UTIL_JOB_IDS), pid=4242, env=env or dict(os.environ), cwd=None, tty=False)
    cap = {"out": [], "err": []}
    saved_env, saved_path, saved_cwd = dict(os.environ), list(sys.path), os.getcwd()
    tj, tc = _job_var.set(job), _capture_var.set(cap)
    try:
        if env is not None:
            _apply_env(env, None)
        if argv and os.path.basename(argv[0]) == "xacro":
            code, out, err = run_xacro(argv[1:])
            cap["out"].append(out)
            cap["err"].append(err)
        elif argv and argv[0] == "ros2":
            job.sync_only = True
            coro = ros2(argv[1:])
            try:
                coro.send(None)
            except StopIteration as stop:
                code = stop.value
            else:
                coro.close()
                raise RuntimeError("command did not complete synchronously")
        else:
            cap["err"].append("{}: command not found\n".format(argv[0] if argv else ""))
            code = 127
    finally:
        _capture_var.reset(tc)
        _job_var.reset(tj)
        if env is not None:
            os.environ.clear()
            os.environ.update(saved_env)
            sys.path[:] = saved_path
            try:
                os.chdir(saved_cwd)
            except OSError:
                pass
    return code, linux_errno("".join(cap["out"])), linux_errno("".join(cap["err"]))


def _opt(x):
    """JS null arrives as pyodide.ffi.jsnull, not None."""
    return None if x is None or type(x).__name__ in ("JsNull", "JsUndefined") else x


def run_json(argv, env=None):
    """run_sync for the worker: never raises, returns JSON {code, stdout, stderr}."""
    try:
        env = _opt(env)
        code, out, err = run_sync(list(argv), dict(env) if env is not None else None)
    except BaseException as e:
        import traceback
        code, out, err = 1, "", "".join(traceback.format_exception(e))
    return json.dumps({"code": code, "stdout": out, "stderr": err})


def xacro_json(path, argv, env=None):
    try:
        env = _opt(env)
        code, out, err = run_sync(["xacro", path] + list(_opt(argv) or []), dict(env) if env is not None else None)
    except BaseException as e:
        import traceback
        code, out, err = 1, "", "".join(traceback.format_exception(e))
    if code == 0:
        return json.dumps({"urdf": out, "stderr": err})
    return json.dumps({"error": (err.strip().splitlines() or ["xacro failed"])[-1], "stderr": err, "code": code})


_patch_launch_ros()
_patch_ros2launch()

# Host protocol (launch-worker.js implements it in JS):
#   HOST.emit(job_id, "out"|"err", text)              text printed by ros2 launch / its processes
#   HOST.started(job_id, info_json)                    a process was "started" (see _fake_execute_process)
#   HOST.signal(job_id, pid, signum)                   a signal for a process (only when host_signals, and SIGKILL)
#   HOST.exited(job_id, pid, rc)                       a process ended (host exit, default signal handling, SIGKILL)
#   HOST.load_composable(job_id, req_json) -> Promise  {container, nodes:[...]} -> {success, error_message, ...} | null
#   HOST.lifecycle(job_id, req_json) -> Promise        {node, transition, transition_id} -> {success, events} | null
#   HOST.done(job_id, code)                            the command finished
