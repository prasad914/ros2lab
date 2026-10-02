// Runs student Python code in a background worker (so an endless loop can be stopped).
// Python itself comes from Pyodide. "rclpy" here is a SMALL PRACTICE SIMULATOR, not real ROS 2.
const PYODIDE_URL = "https://cdn.jsdelivr.net/npm/pyodide@314.0.7/";

const MINI_ROS = String.raw`
import sys, types

class _Logger:
    def __init__(self, name):
        self._name = name
    def info(self, msg):
        print(f"[INFO] [{self._name}]: {msg}")
    def warn(self, msg):
        print(f"[WARN] [{self._name}]: {msg}")
    warning = warn
    def error(self, msg):
        print(f"[ERROR] [{self._name}]: {msg}")

class _World:
    def __init__(self):
        self.reset()
    def reset(self):
        self.subs = {}
        self.timers = []
        self.services = {}
        self.ok = False
        self.time = 0.0
        self.turtle = None
        self.overrides = getattr(self, "overrides", {})

_world = _World()

def _msg_class(name, default):
    def __init__(self, data=default):
        self.data = data
    def __repr__(self):
        return f"{name}(data={self.data!r})"
    return type(name, (), {"__init__": __init__, "__repr__": __repr__})

String = _msg_class("String", "")
Int32 = _msg_class("Int32", 0)
Float64 = _msg_class("Float64", 0.0)
Bool = _msg_class("Bool", False)

def _norm(topic):
    return "/" + str(topic).lstrip("/")

class Vector3:
    def __init__(self, x=0.0, y=0.0, z=0.0):
        self.x, self.y, self.z = x, y, z
    def __repr__(self):
        return f"geometry_msgs.msg.Vector3(x={float(self.x)}, y={float(self.y)}, z={float(self.z)})"

class Twist:
    def __init__(self, linear=None, angular=None):
        self.linear = linear or Vector3()
        self.angular = angular or Vector3()
    def __repr__(self):
        return f"geometry_msgs.msg.Twist(linear={self.linear!r}, angular={self.angular!r})"

class _Turtle:
    """A pretend turtlesim turtle: drives with each Twist for up to 1 second, like the real one."""
    def __init__(self):
        self.x, self.y, self.theta = 5.544445, 5.544445, 0.0
        self.cmd = None
        self.since = 0.0
    def advance(self, until):
        import math
        if self.cmd is not None:
            t = self.since
            end = min(until, self.since + 1.0)
            while t < end - 1e-9:
                dt = min(0.01, end - t)
                self.theta += self.cmd.angular.z * dt
                self.x += math.cos(self.theta) * self.cmd.linear.x * dt
                self.y += math.sin(self.theta) * self.cmd.linear.x * dt
                self.x = min(11.088889, max(0.0, self.x)); self.y = min(11.088889, max(0.0, self.y))
                t += dt
        self.since = until
    def command(self, msg, now):
        self.advance(now)
        self.cmd = msg
        self.since = now

class Publisher:
    def __init__(self, msg_type, topic):
        self.msg_type = msg_type
        self.topic = topic
    def publish(self, msg):
        if not isinstance(msg, self.msg_type):
            raise TypeError(f"This publisher sends {self.msg_type.__name__} messages, but you gave it {type(msg).__name__}.")
        if _norm(self.topic) == "/turtle1/cmd_vel" and isinstance(msg, Twist):
            if _world.turtle is None:
                _world.turtle = _Turtle()
            _world.turtle.command(msg, _world.time)
        for cb in list(_world.subs.get(_norm(self.topic), [])):
            cb(msg)

class Subscription:
    def __init__(self, msg_type, topic, callback):
        self.msg_type = msg_type
        self.topic = topic
        self.callback = callback

class Timer:
    def __init__(self, period, callback):
        if not callable(callback):
            raise TypeError("create_timer needs the method itself, without (). Example: self.create_timer(0.5, self.timer_callback)")
        self.timer_period_ns = int(float(period) * 1e9)
        self.period = float(period)
        self.callback = callback
        self.next = _world.time + self.period
        self.cancelled = False
    def cancel(self):
        self.cancelled = True

class _ParameterValue:
    def __init__(self, v):
        self.bool_value = v if isinstance(v, bool) else False
        self.integer_value = v if isinstance(v, int) and not isinstance(v, bool) else 0
        self.double_value = float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else 0.0
        self.string_value = v if isinstance(v, str) else ""

class Parameter:
    def __init__(self, name, value=None):
        self.name = name
        self.value = value
    def get_parameter_value(self):
        return _ParameterValue(self.value)
    def __repr__(self):
        return f"Parameter(name={self.name!r}, value={self.value!r})"

class _Future:
    def __init__(self):
        self._result = None
        self._done = False
    def done(self):
        return self._done
    def result(self):
        return self._result
    def set_result(self, r):
        self._result, self._done = r, True

class Client:
    def __init__(self, srv_type, name):
        self.srv_type, self.name = srv_type, _norm(name)
    def service_is_ready(self):
        return self.name in _world.services
    def wait_for_service(self, timeout_sec=None):
        if self.name in _world.services:
            return True
        print(f"[INFO] [practice]: service {self.name} not available, waiting again...")
        return False
    def call_async(self, request):
        f = _Future()
        srv = _world.services.get(self.name)
        if srv is not None:
            if srv[0] is not self.srv_type:
                raise TypeError(f"The service {self.name} uses {srv[0].__name__}, but this client uses {self.srv_type.__name__}.")
            f.set_result(srv[1](request, self.srv_type.Response()))
        return f
    def call(self, request):
        f = self.call_async(request)
        if not f.done():
            raise RuntimeError(f"No node offers the service {self.name}, so call() would wait forever.")
        return f.result()

class Service:
    def __init__(self, srv_type, name, callback):
        self.srv_type, self.name, self.callback = srv_type, _norm(name), callback

class Node:
    def __init__(self, node_name):
        self._node_name = node_name
        self._logger = _Logger(node_name)
        self._params = {}
        self._ros_ready = True
    def _check(self):
        if not getattr(self, "_ros_ready", False):
            raise RuntimeError("This node was never set up. Did you forget super().__init__('node_name') in __init__?")
    def get_name(self):
        self._check()
        return self._node_name
    def get_logger(self):
        self._check()
        return self._logger
    def create_publisher(self, msg_type, topic, qos_profile):
        self._check()
        if not isinstance(topic, str):
            raise TypeError("create_publisher(message_type, 'topic_name', 10): the topic name must be text in quotes, given second.")
        return Publisher(msg_type, topic)
    def create_subscription(self, msg_type, topic, callback, qos_profile):
        self._check()
        if not callable(callback):
            raise TypeError("create_subscription needs a callback method (without ()) as the third value.")
        _world.subs.setdefault(_norm(topic), []).append(callback)
        return Subscription(msg_type, topic, callback)
    def create_timer(self, timer_period_sec, callback):
        self._check()
        t = Timer(timer_period_sec, callback)
        _world.timers.append(t)
        return t
    def create_service(self, srv_type, srv_name, callback):
        self._check()
        if not callable(callback):
            raise TypeError("create_service needs a callback method (without ()) as the third value.")
        def _call(req, res):
            out = callback(req, res)
            if out is None:
                raise RuntimeError("The service callback must end with: return response")
            return out
        _world.services[_norm(srv_name)] = (srv_type, _call)
        return Service(srv_type, srv_name, callback)
    def create_client(self, srv_type, srv_name):
        self._check()
        return Client(srv_type, srv_name)
    def declare_parameter(self, name, value=None):
        self._check()
        if name in self._params:
            raise RuntimeError(f"Parameter '{name}' has already been declared")
        if name in _world.overrides:
            value = _world.overrides[name]
        self._params[name] = Parameter(name, value)
        return self._params[name]
    def get_parameter(self, name):
        self._check()
        if name not in self._params:
            raise RuntimeError(f"Parameter '{name}' is not declared. Call self.declare_parameter('{name}', default_value) in __init__ first.")
        return self._params[name]
    def set_parameters(self, params):
        for p in params:
            if p.name not in self._params:
                raise RuntimeError(f"Parameter '{p.name}' is not declared")
            self._params[p.name] = p
        return [True for _ in params]
    def destroy_node(self):
        pass

SIM_SECONDS = 3.0

def init(args=None):
    _world.reset()
    _world.ok = True

def ok():
    return _world.ok

def spin(node=None):
    if not _world.ok:
        raise RuntimeError("Call rclpy.init() before rclpy.spin().")
    end = _world.time + SIM_SECONDS
    while True:
        active = [t for t in _world.timers if not t.cancelled]
        if not active:
            break
        t = min(active, key=lambda x: x.next)
        if t.next > end + 1e-9:
            break
        _world.time = t.next
        t.callback()
        t.next += t.period
    _world.time = end
    if _world.turtle is not None:
        _world.turtle.advance(end)
        t = _world.turtle
        print(f"[turtlesim] turtle1 is now at x={t.x:.2f}, y={t.y:.2f}, theta={t.theta:.2f}")
    print(f"--- practice simulator: stopped after {SIM_SECONDS:g} seconds (real ROS 2 keeps spinning until Ctrl+C) ---")

def spin_until_future_complete(node, future, timeout_sec=None):
    if not future.done():
        raise RuntimeError("Nobody answered: no node offers this service in the practice simulator.")

def spin_once(node=None, timeout_sec=None):
    active = [t for t in _world.timers if not t.cancelled]
    if active:
        t = min(active, key=lambda x: x.next)
        _world.time = t.next
        t.callback()
        t.next += t.period

def shutdown():
    _world.ok = False

def _reset():
    _world.overrides = dict(getattr(sys.modules["rclpy"], "_world_overrides", {}) or {})
    _world.reset()

_rclpy = types.ModuleType("rclpy")
for _n in ["init", "ok", "spin", "spin_once", "spin_until_future_complete", "shutdown", "_reset", "SIM_SECONDS"]:
    setattr(_rclpy, _n, globals()[_n])
_rclpy_node = types.ModuleType("rclpy.node")
_rclpy_node.Node = Node
_rclpy.node = _rclpy_node
_rclpy_param = types.ModuleType("rclpy.parameter")
_rclpy_param.Parameter = Parameter
_rclpy.parameter = _rclpy_param

def _srv(name, req_fields, res_fields):
    def mk(kind, fields):
        def __init__(self, **kw):
            for k, v in fields.items():
                setattr(self, k, kw.get(k, v))
        def __repr__(self):
            inner = ", ".join(f"{k}={getattr(self, k)!r}" for k in fields)
            return f"{name}_{kind}({inner})"
        return type(f"{name}_{kind}", (), {"__init__": __init__, "__repr__": __repr__})
    return type(name, (), {"Request": mk("Request", req_fields), "Response": mk("Response", res_fields)})

AddTwoInts = _srv("AddTwoInts", {"a": 0, "b": 0}, {"sum": 0})
Trigger = _srv("Trigger", {}, {"success": False, "message": ""})
SetBool = _srv("SetBool", {"data": False}, {"success": False, "message": ""})
_ex = types.ModuleType("example_interfaces"); _ex_srv = types.ModuleType("example_interfaces.srv"); _ex_srv.AddTwoInts = AddTwoInts; _ex_srv.Trigger = Trigger; _ex_srv.SetBool = SetBool; _ex.srv = _ex_srv
_ss = types.ModuleType("std_srvs"); _ss_srv = types.ModuleType("std_srvs.srv"); _ss_srv.Trigger = Trigger; _ss_srv.SetBool = SetBool; _ss.srv = _ss_srv
_gm = types.ModuleType("geometry_msgs"); _gm_msg = types.ModuleType("geometry_msgs.msg"); _gm_msg.Twist = Twist; _gm_msg.Vector3 = Vector3; _gm.msg = _gm_msg
sys.modules.update({"rclpy.parameter": _rclpy_param, "example_interfaces": _ex, "example_interfaces.srv": _ex_srv, "std_srvs": _ss, "std_srvs.srv": _ss_srv, "geometry_msgs": _gm, "geometry_msgs.msg": _gm_msg})
_std = types.ModuleType("std_msgs")
_std_msg = types.ModuleType("std_msgs.msg")
for _c in [String, Int32, Float64, Bool]:
    setattr(_std_msg, _c.__name__, _c)
_std.msg = _std_msg
sys.modules.update({"rclpy": _rclpy, "rclpy.node": _rclpy_node, "std_msgs": _std, "std_msgs.msg": _std_msg})
`;

let pyodide = null;
let current = null;
let inputs = [];
const outDec = new TextDecoder(), errDec = new TextDecoder();

async function boot() {
  const { loadPyodide } = await import(PYODIDE_URL + "pyodide.mjs");
  pyodide = await loadPyodide({ indexURL: PYODIDE_URL });
  pyodide.setStdout({ write: (buf) => { if (current) postMessage({ id: current, type: "out", text: outDec.decode(buf, { stream: true }) }); return buf.length; } });
  pyodide.setStderr({ write: (buf) => { if (current) postMessage({ id: current, type: "err", text: errDec.decode(buf, { stream: true }) }); return buf.length; } });
  // input() reads the lesson's prepared answers, and shows them like typed text
  pyodide.setStdin({ stdin: () => {
    if (!inputs.length) return null;
    const v = String(inputs.shift());
    if (current) postMessage({ id: current, type: "out", text: v + "\n" });
    return v + "\n";
  } });
  pyodide.runPython(MINI_ROS);
}

self.onmessage = async (e) => {
  const { id, code } = e.data;
  current = id;
  inputs = Array.isArray(e.data.inputs) ? e.data.inputs.slice() : [];
  try {
    if (!pyodide) { postMessage({ id, type: "status", text: "Starting Python (first time only, about 5–15 seconds)…" }); await boot(); }
    postMessage({ id, type: "status", text: "" });
    pyodide.globals.set("_overrides_json", JSON.stringify(e.data.params || {}));
    pyodide.runPython("import json as _j, rclpy as _r\n_r._world_overrides = _j.loads(_overrides_json)\n_r._reset()");
    const ns = pyodide.globals.get("dict")();
    ns.set("__name__", "__main__");
    await pyodide.runPythonAsync(code, { globals: ns });
    ns.destroy();
    postMessage({ id, type: "done" });
  } catch (err) {
    postMessage({ id, type: "error", text: String((err && err.message) || err) });
  }
};
