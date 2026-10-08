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

# ===================== practice-simulator extension (Week 5): QoS, typed messages, =====================
# ===================== parameter callbacks and YAML files, actions, the service deadlock ==============
import collections as _collections, enum as _enum, time as _time

_orig_world_reset = _World.reset
def _world_reset2(self):
    _orig_world_reset(self)
    self.in_cb = 0
    self.pubs = {}
    self.pending = []
    self.actions = {}
    self.lazy = []
    self.goal_seq = 0
    self.node_overrides = getattr(self, "node_overrides", {})
_World.reset = _world_reset2
_world.reset()

def _sim_sleep(seconds):
    _world.time += float(seconds)
_time.sleep = _sim_sleep

def _guard(fn):
    if getattr(fn, "_guarded", False):
        return fn
    def run(*a, **k):
        _world.in_cb += 1
        try:
            return fn(*a, **k)
        finally:
            _world.in_cb -= 1
    run._guarded = True
    return run

_orig_timer_init = Timer.__init__
def _timer_init2(self, period, callback):
    _orig_timer_init(self, period, callback)
    self.callback = _guard(callback)
Timer.__init__ = _timer_init2

_DEADLOCK = ("Deadlock! {what} waits for an answer, but it is running INSIDE a callback. The executor is busy "
             "running this callback, so the answer can never be processed and the real node would freeze forever. "
             "Use client.call_async(request) and future.add_done_callback(...) instead.")
_orig_client_call = Client.call
def _client_call2(self, request):
    if _world.in_cb:
        raise RuntimeError(_DEADLOCK.format(what="client.call()"))
    return _orig_client_call(self, request)
Client.call = _client_call2

def _f_add_done(self, cb):
    if self._done:
        cb(self)
    else:
        self.__dict__.setdefault("_cbs", []).append(cb)
_Future.add_done_callback = _f_add_done
_orig_set_result = _Future.set_result
def _set_result2(self, r):
    _orig_set_result(self, r)
    for cb in self.__dict__.pop("_cbs", []):
        cb(self)
_Future.set_result = _set_result2

# ---------------- QoS ----------------
class ReliabilityPolicy(_enum.Enum):
    SYSTEM_DEFAULT = 0
    RELIABLE = 1
    BEST_EFFORT = 2
class DurabilityPolicy(_enum.Enum):
    SYSTEM_DEFAULT = 0
    TRANSIENT_LOCAL = 1
    VOLATILE = 2
class HistoryPolicy(_enum.Enum):
    SYSTEM_DEFAULT = 0
    KEEP_LAST = 1
    KEEP_ALL = 2
class QoSProfile:
    def __init__(self, depth=10, reliability=ReliabilityPolicy.RELIABLE, durability=DurabilityPolicy.VOLATILE,
                 history=HistoryPolicy.KEEP_LAST, **kw):
        self.depth, self.reliability, self.durability, self.history = depth, reliability, durability, history
    def __repr__(self):
        return f"QoSProfile(reliability={self.reliability.name}, durability={self.durability.name}, depth={self.depth})"
qos_profile_sensor_data = QoSProfile(depth=5, reliability=ReliabilityPolicy.BEST_EFFORT)
qos_profile_system_default = QoSProfile(depth=10)

def _qos(q):
    if isinstance(q, QoSProfile):
        return q
    if isinstance(q, int) and not isinstance(q, bool):
        return QoSProfile(depth=q)
    raise TypeError("The last value must be a queue depth such as 10, or a QoSProfile(...).")

def _incompatible(pub, sub):
    if pub.reliability == ReliabilityPolicy.BEST_EFFORT and sub.reliability == ReliabilityPolicy.RELIABLE:
        return "RELIABILITY"
    if pub.durability == DurabilityPolicy.VOLATILE and sub.durability == DurabilityPolicy.TRANSIENT_LOCAL:
        return "DURABILITY"
    return None

def _qos_warn(pub, sub_node, why, topic):
    t = _norm(topic)
    print(f"[WARN] [{pub.node._node_name}]: New subscription discovered on topic '{t}', requesting incompatible QoS. "
          f"No messages will be sent to it. Last incompatible policy: {why}")
    print(f"[WARN] [{sub_node._node_name}]: New publisher discovered on topic '{t}', offering incompatible QoS. "
          f"No messages will be received from it. Last incompatible policy: {why}")

_orig_create_publisher = Node.create_publisher
def _create_publisher2(self, msg_type, topic, qos_profile):
    p = _orig_create_publisher(self, msg_type, topic, qos_profile)
    p.qos, p.node = _qos(qos_profile), self
    p.history = _collections.deque(maxlen=max(1, p.qos.depth or 1))
    _world.pubs.setdefault(_norm(topic), []).append(p)
    for s in _world.subs.get(_norm(topic), []):
        why = _incompatible(p.qos, getattr(s, "_qos", QoSProfile()))
        if why and hasattr(s, "_node"):
            _qos_warn(p, s._node, why, topic)
    return p
Node.create_publisher = _create_publisher2

def _create_subscription2(self, msg_type, topic, callback, qos_profile):
    self._check()
    if not callable(callback):
        raise TypeError("create_subscription needs a callback method (without ()) as the third value.")
    q = _qos(qos_profile)
    cb = _guard(callback)
    def deliver(msg):
        cb(msg)
    deliver._qos, deliver._node = q, self
    _world.subs.setdefault(_norm(topic), []).append(deliver)
    for p in _world.pubs.get(_norm(topic), []):
        why = _incompatible(p.qos, q)
        if why:
            _qos_warn(p, self, why, topic)
        elif q.durability == DurabilityPolicy.TRANSIENT_LOCAL and p.qos.durability == DurabilityPolicy.TRANSIENT_LOCAL:
            for m in p.history:
                _world.pending.append((deliver, m))
    return Subscription(msg_type, topic, callback)
Node.create_subscription = _create_subscription2

def _publish2(self, msg):
    if not isinstance(msg, self.msg_type):
        raise TypeError(f"This publisher sends {self.msg_type.__name__} messages, but you gave it {type(msg).__name__}.")
    if _norm(self.topic) == "/turtle1/cmd_vel" and isinstance(msg, Twist):
        if _world.turtle is None:
            _world.turtle = _Turtle()
        _world.turtle.command(msg, _world.time)
    q = getattr(self, "qos", QoSProfile())
    if hasattr(self, "history"):
        self.history.append(msg)
    for cb in list(_world.subs.get(_norm(self.topic), [])):
        if _incompatible(q, getattr(cb, "_qos", QoSProfile())):
            continue
        cb(msg)
Publisher.publish = _publish2

# ---------------- messages with typed fields (like real rclpy) ----------------
def _ok(kind, v):
    if kind.endswith("[]"):
        return isinstance(v, (list, tuple)) and all(_ok(kind[:-2], x) for x in v)
    return {"float": isinstance(v, float), "int": isinstance(v, int) and not isinstance(v, bool),
            "bool": isinstance(v, bool), "str": isinstance(v, str)}[kind]

def _typed(full, fields):
    pkg, kind_dir, short = full.split("/")
    names = [f[0] for f in fields]
    def __init__(self, **kw):
        for n, k, d in fields:
            object.__setattr__(self, "_" + n, list(d) if isinstance(d, list) else d)
        for k, v in kw.items():
            setattr(self, k, v)
    def __setattr__(self, k, v):
        if k not in names:
            raise AttributeError(f"'{short}' object has no attribute '{k}'")
        object.__setattr__(self, k, v)
    def __repr__(self):
        inner = ", ".join(f"{n}={getattr(self, n)!r}" for n in names)
        return f"{pkg}.{kind_dir}.{short}({inner})"
    ns = {"__init__": __init__, "__setattr__": __setattr__, "__repr__": __repr__, "_fields": names}
    for n, k, d in fields:
        def g(self, n=n):
            return getattr(self, "_" + n)
        def s(self, v, n=n, k=k):
            if not _ok(k, v):
                base = k[:-2] if k.endswith("[]") else k
                if k.endswith("[]"):
                    raise AssertionError(f"The '{n}' field must be a set or sequence and each value of type '{base}'")
                raise AssertionError(f"The '{n}' field must be of type '{base}'")
            object.__setattr__(self, "_" + n, list(v) if k.endswith("[]") else v)
        ns[n] = property(g, s)
    return type(short, (), ns)

def _typed_srv(full, req, res):
    short = full.split("/")[-1]
    return type(short, (), {"Request": _typed(full + "_Request", req), "Response": _typed(full + "_Response", res)})

def _typed_action(full, goal, result, feedback):
    short = full.split("/")[-1]
    return type(short, (), {"Goal": _typed(full + "_Goal", goal), "Result": _typed(full + "_Result", result),
                            "Feedback": _typed(full + "_Feedback", feedback)})

BatteryStatus = _typed("my_robot_interfaces/msg/BatteryStatus",
                       [("robot_name", "str", ""), ("voltage", "float", 0.0), ("percentage", "float", 0.0), ("is_charging", "bool", False)])
SetSpeed = _typed_srv("my_robot_interfaces/srv/SetSpeed", [("speed", "float", 0.0)], [("success", "bool", False), ("message", "str", "")])
Countdown = _typed_action("my_robot_interfaces/action/Countdown", [("start_from", "int", 0)], [("message", "str", "")], [("current", "int", 0)])
Fibonacci = _typed_action("example_interfaces/action/Fibonacci", [("order", "int", 0)], [("sequence", "int[]", [])], [("sequence", "int[]", [])])
SetParametersResult = _typed("rcl_interfaces/msg/SetParametersResult", [("successful", "bool", False), ("reason", "str", "")])

class GoalStatus:
    STATUS_UNKNOWN, STATUS_ACCEPTED, STATUS_EXECUTING, STATUS_CANCELING = 0, 1, 2, 3
    STATUS_SUCCEEDED, STATUS_CANCELED, STATUS_ABORTED = 4, 5, 6

# ---------------- parameters: types, callbacks, YAML files ----------------
class _PType(_enum.IntEnum):
    NOT_SET = 0
    BOOL = 1
    INTEGER = 2
    DOUBLE = 3
    STRING = 4
    BYTE_ARRAY = 5
    BOOL_ARRAY = 6
    INTEGER_ARRAY = 7
    DOUBLE_ARRAY = 8
    STRING_ARRAY = 9
_TNAME = {1: "bool", 2: "integer", 3: "double", 4: "string", 6: "bool_array", 7: "integer_array", 8: "double_array", 9: "string_array"}

def _infer(v):
    if v is None: return _PType.NOT_SET
    if isinstance(v, bool): return _PType.BOOL
    if isinstance(v, int): return _PType.INTEGER
    if isinstance(v, float): return _PType.DOUBLE
    if isinstance(v, str): return _PType.STRING
    if isinstance(v, (list, tuple)) and v:
        for t, kind in ((bool, _PType.BOOL_ARRAY), (int, _PType.INTEGER_ARRAY), (float, _PType.DOUBLE_ARRAY), (str, _PType.STRING_ARRAY)):
            if all(isinstance(x, t) for x in v): return kind
    raise TypeError(f"Parameters can be bool, int, float, str or lists of them, not {type(v).__name__}.")

class Parameter:
    Type = _PType
    def __init__(self, name, type_=None, value=None):
        if type_ is not None and not isinstance(type_, _PType):
            value, type_ = type_, None
        self.name, self.value = name, value
        self.type_ = type_ if type_ is not None else _infer(value)
    def get_parameter_value(self):
        return _ParameterValue(self.value)
    def __repr__(self):
        return f"Parameter(name={self.name!r}, value={self.value!r})"
_rclpy_param.Parameter = Parameter

def _declare2(self, name, value=None, descriptor=None, ignore_override=False):
    self._check()
    if name in self._params:
        raise RuntimeError(f"ParameterAlreadyDeclaredException: parameter '{name}' has already been declared")
    if not ignore_override:
        own = _world.node_overrides.get(self._node_name, {})
        anyone = _world.node_overrides.get("/**", {})
        if name in own: value = own[name]
        elif name in anyone: value = anyone[name]
        elif name in _world.overrides: value = _world.overrides[name]
    self._params[name] = Parameter(name, value=value)
    return self._params[name]
Node.declare_parameter = _declare2

def _get_parameter2(self, name):
    self._check()
    if name not in self._params:
        raise RuntimeError(f"ParameterNotDeclaredException: Invalid access to undeclared parameter(s): ['{name}']. "
                           f"Declare it first in __init__: self.declare_parameter('{name}', default_value)")
    return self._params[name]
Node.get_parameter = _get_parameter2

def _cb_adder(attr):
    def add(self, callback):
        if not callable(callback):
            raise TypeError("Give the callback method itself, without ().")
        self.__dict__.setdefault(attr, []).append(callback)
        return callback
    return add
Node.add_on_set_parameters_callback = _cb_adder("_on_set")
Node.add_pre_set_parameters_callback = _cb_adder("_pre_set")
Node.add_post_set_parameters_callback = _cb_adder("_post_set")

def _set_parameters2(self, params):
    results = []
    for p in params:
        if p.name not in self._params:
            results.append(SetParametersResult(successful=False, reason=f"parameter '{p.name}' is not declared"))
            continue
        plist = [p]
        for cb in self.__dict__.get("_pre_set", []):
            out = cb(plist)
            plist = out if out is not None else plist
        reason = None
        for q in plist:
            old = self._params.get(q.name)
            if old is not None and old.type_ != _PType.NOT_SET and q.type_ != old.type_:
                _TT = {1: "Type.BOOL", 2: "Type.INTEGER", 3: "Type.DOUBLE", 4: "Type.STRING", 6: "Type.BOOL_ARRAY", 7: "Type.INTEGER_ARRAY", 8: "Type.DOUBLE_ARRAY", 9: "Type.STRING_ARRAY"}
                reason = f"Wrong parameter type, expected '{_TT.get(int(old.type_), old.type_)}' got '{_TT.get(int(q.type_), q.type_)}'"   # rclpy's wording
        if reason is None:
            for cb in self.__dict__.get("_on_set", []):
                r = _guard(cb)(plist)
                if not isinstance(r, SetParametersResult):
                    raise TypeError("An on-set parameters callback must return SetParametersResult(successful=True) or (successful=False, reason='...').")
                if not r.successful:
                    reason = r.reason or "rejected by the node's parameter callback"
                    break
        if reason is not None:
            results.append(SetParametersResult(successful=False, reason=reason))
            continue
        for q in plist:
            self._params[q.name] = q
        for cb in self.__dict__.get("_post_set", []):
            _guard(cb)(plist)
        results.append(SetParametersResult(successful=True))
    return results
Node.set_parameters = _set_parameters2

def _cli_value(v):
    if not isinstance(v, str): return v
    s = v.strip()
    if s in ("true", "True"): return True
    if s in ("false", "False"): return False
    try: return int(s)
    except ValueError: pass
    try: return float(s)
    except ValueError: return s.strip("'\"")

def ros2_param_set(node, name, value):
    r = node.set_parameters([Parameter(name, value=_cli_value(value))])[0]
    print("Set parameter successful" if r.successful else f"Setting parameter failed: {r.reason}")

def ros2_param_get(node, name):
    if name not in node._params:
        print("Parameter not set."); return
    p = node._params[name]
    label = {_PType.BOOL: "Boolean", _PType.INTEGER: "Integer", _PType.DOUBLE: "Double", _PType.STRING: "String"}.get(p.type_, "Value")
    print(f"{label} value is: {p.value}")

def use_params_file(text):
    if "\t" in text:
        raise ValueError("YAML error: this file contains a Tab. YAML only allows spaces for indentation.")
    tree, stack = {}, [(-1, None)]
    root = tree
    path = []
    for raw in text.splitlines():
        line = raw.split(" #")[0].rstrip()
        if not line.strip() or line.strip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip(" "))
        key, _, val = line.strip().partition(":")
        key = key.strip().strip("'\"")
        while stack and indent <= stack[-1][0]:
            stack.pop(); path.pop() if path else None
        node = root
        for k in path:
            node = node[k]
        if val.strip() == "":
            node[key] = {}
            stack.append((indent, key)); path.append(key)
        else:
            v = val.strip()
            if v.startswith("[") and v.endswith("]"):
                node[key] = [_cli_value(x) for x in v[1:-1].split(",") if x.strip()]
            else:
                node[key] = _cli_value(v)
    _world.node_overrides = {}
    for node_name, body in tree.items():
        nn = node_name.lstrip("/") if node_name != "/**" else "/**"
        if not isinstance(body, dict) or "ros__parameters" not in body:
            print(f"(practice) '{node_name}' has no 'ros__parameters' key, so ROS 2 does not apply these values "
                  f"as parameters. Check the spelling: ros__parameters has TWO underscores.")
            continue
        _world.node_overrides[nn] = dict(body["ros__parameters"])

_orig_run_reset = _reset
def _reset_run():
    _world.node_overrides = {}
    _orig_run_reset()
_rclpy._reset = _reset_run

# ---------------- actions ----------------
class GoalResponse(_enum.Enum):
    REJECT = 1
    ACCEPT = 2
class CancelResponse(_enum.Enum):
    REJECT = 1
    ACCEPT = 2

class _ServerGoalHandle:
    def __init__(self, server, request, gid):
        self.request, self.goal_id, self._server = request, gid, server
        self.status = GoalStatus.STATUS_EXECUTING
        self._cancel_requested = False
    @property
    def is_cancel_requested(self):
        return self._cancel_requested
    @property
    def is_active(self):
        return self.status in (1, 2, 3)
    def publish_feedback(self, feedback):
        if not isinstance(feedback, self._server.action_type.Feedback):
            raise TypeError("publish_feedback() needs a Feedback message, for example Countdown.Feedback().")
        for cb in self._server._feedback_cbs.get(self.goal_id, []):
            cb(feedback)
    def succeed(self):
        self.status = GoalStatus.STATUS_SUCCEEDED
    def abort(self):
        self.status = GoalStatus.STATUS_ABORTED
    def canceled(self):
        self.status = GoalStatus.STATUS_CANCELED

class ActionServer:
    def __init__(self, node, action_type, action_name, execute_callback, goal_callback=None, cancel_callback=None, **kw):
        node._check()
        if not callable(execute_callback):
            raise TypeError("ActionServer(node, ActionType, 'name', self.execute_callback): give the method itself, without ().")
        self.node, self.action_type, self.name = node, action_type, _norm(action_name)
        self.execute_callback = execute_callback
        self.goal_callback = goal_callback or (lambda goal: GoalResponse.ACCEPT)
        self.cancel_callback = cancel_callback or (lambda goal_handle: CancelResponse.REJECT)
        self._feedback_cbs = {}
        _world.actions[self.name] = self

class _FeedbackMessage:
    def __init__(self, goal_id, feedback):
        self.goal_id, self.feedback = goal_id, feedback

class _GetResultResponse:
    def __init__(self, result, status):
        self.result, self.status = result, status

class _ClientGoalHandle:
    def __init__(self, client, server, accepted, gid, goal, feedback_callback):
        self.accepted, self.goal_id = accepted, gid
        self._client, self._server, self._goal, self._fb = client, server, goal, feedback_callback
        self._cancel = False
        self.status = GoalStatus.STATUS_ACCEPTED if accepted else GoalStatus.STATUS_UNKNOWN
    def get_result_async(self):
        f = _Future()
        if not self.accepted:
            raise RuntimeError("This goal was rejected, so it has no result.")
        f._run = lambda: _run_goal(self, f)
        _world.lazy.append(f)
        return f
    def cancel_goal_async(self):
        self._cancel = True
        f = _Future(); f.set_result(None)
        return f

def _run_goal(handle, fut):
    srv = handle._server
    sgh = _ServerGoalHandle(srv, handle._goal, handle.goal_id)
    if handle._fb is not None:
        srv._feedback_cbs[handle.goal_id] = [lambda fb: _guard(handle._fb)(_FeedbackMessage(handle.goal_id, fb))]
    if handle._cancel and _guard(srv.cancel_callback)(sgh) == CancelResponse.ACCEPT:
        sgh._cancel_requested = True
    result = _guard(srv.execute_callback)(sgh)
    if sgh.status == GoalStatus.STATUS_EXECUTING:
        print(f"[WARN] [{srv.node._node_name}]: Goal state not set, assuming aborted. Goal ID: {handle.goal_id}")
        sgh.status = GoalStatus.STATUS_ABORTED
    if not isinstance(result, srv.action_type.Result):
        raise RuntimeError("The execute callback must end with: return result   (a Result message, for example Countdown.Result()).")
    handle.status = sgh.status
    fut.set_result(_GetResultResponse(result, sgh.status))

class ActionClient:
    def __init__(self, node, action_type, action_name, **kw):
        node._check()
        self.node, self.action_type, self.name = node, action_type, _norm(action_name)
    def server_is_ready(self):
        return self.name in _world.actions
    def wait_for_server(self, timeout_sec=None):
        if self.name in _world.actions:
            return True
        print(f"[INFO] [{self.node._node_name}]: (practice) no action server called {self.name} is running, so this would wait.")
        return False
    def send_goal_async(self, goal, feedback_callback=None):
        f = _Future()
        srv = _world.actions.get(self.name)
        if srv is None:
            return f
        if srv.action_type is not self.action_type:
            raise TypeError(f"The action {self.name} uses {srv.action_type.__name__}, but this client uses {self.action_type.__name__}.")
        if not isinstance(goal, self.action_type.Goal):
            raise TypeError("send_goal_async() needs a Goal message, for example Countdown.Goal().")
        _world.goal_seq += 1
        accepted = _guard(srv.goal_callback)(goal) == GoalResponse.ACCEPT
        f.set_result(_ClientGoalHandle(self, srv, accepted, _world.goal_seq, goal, feedback_callback))
        return f

def _flush():
    while _world.pending or _world.lazy:
        while _world.pending:
            cb, m = _world.pending.pop(0)
            cb(m)
        while _world.lazy:
            f = _world.lazy.pop(0)
            if not f.done():
                f._run()

_orig_spin = spin
def spin2(node=None):
    if _world.in_cb:
        raise RuntimeError(_DEADLOCK.format(what="rclpy.spin()"))
    _flush()
    return _orig_spin(node)
_orig_spin_once = spin_once
def spin_once2(node=None, timeout_sec=None):
    _flush()
    return _orig_spin_once(node, timeout_sec)
def spin_until_future_complete2(node, future, timeout_sec=None):
    if _world.in_cb:
        raise RuntimeError(_DEADLOCK.format(what="spin_until_future_complete()"))
    _flush()
    if not future.done() and hasattr(future, "_run"):
        future._run()
    if not future.done():
        raise RuntimeError("Nobody answered: no node offers this service or action in the practice simulator.")
_rclpy.spin, _rclpy.spin_once, _rclpy.spin_until_future_complete = spin2, spin_once2, spin_until_future_complete2

def _mod(name, **attrs):
    m = types.ModuleType(name)
    for k, v in attrs.items():
        setattr(m, k, v)
    sys.modules[name] = m
    return m
_rclpy.qos = _mod("rclpy.qos", QoSProfile=QoSProfile, ReliabilityPolicy=ReliabilityPolicy, DurabilityPolicy=DurabilityPolicy,
                  HistoryPolicy=HistoryPolicy, qos_profile_sensor_data=qos_profile_sensor_data, qos_profile_system_default=qos_profile_system_default)
_rclpy.action = _mod("rclpy.action", ActionServer=ActionServer, ActionClient=ActionClient, GoalResponse=GoalResponse, CancelResponse=CancelResponse)
_mod("rcl_interfaces"); sys.modules["rcl_interfaces"].msg = _mod("rcl_interfaces.msg", SetParametersResult=SetParametersResult)
_mod("action_msgs"); sys.modules["action_msgs"].msg = _mod("action_msgs.msg", GoalStatus=GoalStatus)
_mri = _mod("my_robot_interfaces")
_mri.msg = _mod("my_robot_interfaces.msg", BatteryStatus=BatteryStatus)
_mri.srv = _mod("my_robot_interfaces.srv", SetSpeed=SetSpeed)
_mri.action = _mod("my_robot_interfaces.action", Countdown=Countdown)
_ex.action = _mod("example_interfaces.action", Fibonacci=Fibonacci)
_mod("practice", ros2_param_set=ros2_param_set, ros2_param_get=ros2_param_get, use_params_file=use_params_file)
# ===================== practice-simulator extension (Weeks 6 and 7) =====================
# turtlesim world with poses and services, more message types, clock, tf2, executors, drawings
import math as _math, json as _json

def _plain_msg(full, fields):
    """A simple message class. fields: list of (name, default_factory)."""
    pkg, kind_dir, short = full.split("/")
    names = [f[0] for f in fields]
    def __init__(self, **kw):
        for n, d in fields:
            setattr(self, n, d())
        for k, v in kw.items():
            if k not in names:
                raise AttributeError(f"'{short}' object has no attribute '{k}'")
            setattr(self, k, v)
    def __repr__(self):
        return f"{pkg}.{kind_dir}.{short}(" + ", ".join(f"{n}={getattr(self, n)!r}" for n in names) + ")"
    return type(short, (), {"__init__": __init__, "__repr__": __repr__, "_fields": names, "_full": full})

Time_ = _plain_msg("builtin_interfaces/msg/Time", [("sec", int), ("nanosec", int)])
Duration_ = _plain_msg("builtin_interfaces/msg/Duration", [("sec", int), ("nanosec", int)])
Header = _plain_msg("std_msgs/msg/Header", [("stamp", Time_), ("frame_id", str)])
Point = _plain_msg("geometry_msgs/msg/Point", [("x", float), ("y", float), ("z", float)])
Quaternion = _plain_msg("geometry_msgs/msg/Quaternion", [("x", float), ("y", float), ("z", float), ("w", lambda: 1.0)])
Pose = _plain_msg("geometry_msgs/msg/Pose", [("position", Point), ("orientation", Quaternion)])
Pose2D = _plain_msg("geometry_msgs/msg/Pose2D", [("x", float), ("y", float), ("theta", float)])
PoseStamped = _plain_msg("geometry_msgs/msg/PoseStamped", [("header", Header), ("pose", Pose)])
PointStamped = _plain_msg("geometry_msgs/msg/PointStamped", [("header", Header), ("point", Point)])
Transform = _plain_msg("geometry_msgs/msg/Transform", [("translation", Vector3), ("rotation", Quaternion)])
TransformStamped = _plain_msg("geometry_msgs/msg/TransformStamped", [("header", Header), ("child_frame_id", str), ("transform", Transform)])
TwistStamped = _plain_msg("geometry_msgs/msg/TwistStamped", [("header", Header), ("twist", Twist)])
PoseWithCovariance = _plain_msg("geometry_msgs/msg/PoseWithCovariance", [("pose", Pose), ("covariance", lambda: [0.0] * 36)])
TwistWithCovariance = _plain_msg("geometry_msgs/msg/TwistWithCovariance", [("twist", Twist), ("covariance", lambda: [0.0] * 36)])
Odometry = _plain_msg("nav_msgs/msg/Odometry", [("header", Header), ("child_frame_id", str), ("pose", PoseWithCovariance), ("twist", TwistWithCovariance)])
JointState = _plain_msg("sensor_msgs/msg/JointState", [("header", Header), ("name", list), ("position", list), ("velocity", list), ("effort", list)])
JointTrajectoryPoint = _plain_msg("trajectory_msgs/msg/JointTrajectoryPoint", [("positions", list), ("velocities", list), ("time_from_start", Duration_)])
JointTrajectory = _plain_msg("trajectory_msgs/msg/JointTrajectory", [("header", Header), ("joint_names", list), ("points", list)])
TPose = _plain_msg("turtlesim/msg/Pose", [("x", float), ("y", float), ("theta", float), ("linear_velocity", float), ("angular_velocity", float)])
Empty = _srv("Empty", {}, {})
Spawn = _srv("Spawn", {"x": 0.0, "y": 0.0, "theta": 0.0, "name": ""}, {"name": ""})
Kill = _srv("Kill", {"name": ""}, {})
TeleportAbsolute = _srv("TeleportAbsolute", {"x": 0.0, "y": 0.0, "theta": 0.0}, {})
TeleportRelative = _srv("TeleportRelative", {"linear": 0.0, "angular": 0.0}, {})
SetPen = _srv("SetPen", {"r": 0, "g": 0, "b": 0, "width": 3, "off": 0}, {})
GoTo = _typed_srv("my_robot_interfaces/srv/GoTo", [("x", "float", 0.0), ("y", "float", 0.0)], [("success", "bool", False), ("message", "str", "")])
DriveDistance = _typed_action("my_robot_interfaces/action/DriveDistance", [("distance", "float", 0.0), ("speed", "float", 0.5)],
                              [("distance_driven", "float", 0.0)], [("remaining", "float", 0.0)])
RobotStatus = _typed("my_robot_interfaces/msg/RobotStatus", [("name", "str", ""), ("x", "float", 0.0), ("y", "float", 0.0), ("battery", "float", 100.0), ("moving", "bool", False)])
MoveArm = _typed_srv("my_robot_interfaces/srv/MoveArm", [("x", "float", 0.0), ("y", "float", 0.0)],
                     [("success", "bool", False), ("shoulder", "float", 0.0), ("elbow", "float", 0.0), ("message", "str", "")])

# ---------------- the pretend turtlesim world ----------------
class _T:
    def __init__(self, name, x=5.544445, y=5.544445, theta=0.0):
        self.name, self.x, self.y, self.theta = name, float(x), float(y), float(theta)
        self.cmd, self.since = None, 0.0
        self.pen = (179, 184, 255); self.pen_on = True
        self.path = [[[round(self.x, 3), round(self.y, 3)]]]
        self.walls = 0
    def advance(self, until):
        if self.cmd is not None and until > self.since:
            t0 = getattr(self, "cmd_t0", self.since)       # a command lasts 1 s, like the real turtlesim
            t, end = self.since, min(until, t0 + 1.0)
            while t < end - 1e-9:
                dt = min(0.01, end - t)
                self.theta += self.cmd.angular.z * dt
                nx = self.x + _math.cos(self.theta) * self.cmd.linear.x * dt
                ny = self.y + _math.sin(self.theta) * self.cmd.linear.x * dt
                cx, cy = min(11.088889, max(0.0, nx)), min(11.088889, max(0.0, ny))
                if (cx, cy) != (nx, ny) and self.walls < 3:
                    self.walls += 1
                    print(f"[WARN] [turtlesim]: Oh no! I hit the wall! (Clamping from [x={nx:.6f}, y={ny:.6f}])")
                self.x, self.y = cx, cy
                t += dt
            self.theta = _math.atan2(_math.sin(self.theta), _math.cos(self.theta))
            if self.pen_on:
                self.path[-1].append([round(self.x, 3), round(self.y, 3)])
            if until >= t0 + 1.0:
                self.cmd = None
        self.since = max(self.since, until)
    def moving(self):
        return self.cmd is not None

class _Tick:
    """internal timer: turtlesim publishes every turtle's pose every 0.1 s"""
    def __init__(self):
        self.period, self.next, self.cancelled = 0.1, _world.time + 0.1, False
    def callback(self):
        for t in list(_world.tw.values()):
            t.advance(_world.time)
            m = TPose(x=t.x, y=t.y, theta=t.theta,
                      linear_velocity=(t.cmd.linear.x if t.cmd else 0.0), angular_velocity=(t.cmd.angular.z if t.cmd else 0.0))
            for cb in list(_world.subs.get(f"/{t.name}/pose", [])):
                cb(m)

def _tw_active():
    return _world.tw is not None

def _tw_activate():
    if _world.tw is not None:
        return
    _world.tw = {"turtle1": _T("turtle1")}
    _world.timers.append(_Tick())
    _tw_services("turtle1")
    for nm, typ, fn in [("/spawn", Spawn, _srv_spawn), ("/kill", Kill, _srv_kill), ("/reset", Empty, _srv_reset), ("/clear", Empty, _srv_clear)]:
        _world.services[nm] = (typ, fn)

def _tw_services(name):
    def tele_abs(req, res, name=name):
        t = _world.tw.get(name)
        t.advance(_world.time); t.x, t.y, t.theta = float(req.x), float(req.y), float(req.theta)
        if t.pen_on: t.path[-1].append([round(t.x, 3), round(t.y, 3)])
        return res
    def tele_rel(req, res, name=name):
        t = _world.tw.get(name)
        t.advance(_world.time); t.theta += float(req.angular)
        t.x += _math.cos(t.theta) * float(req.linear); t.y += _math.sin(t.theta) * float(req.linear)
        if t.pen_on: t.path[-1].append([round(t.x, 3), round(t.y, 3)])
        return res
    def set_pen(req, res, name=name):
        t = _world.tw.get(name)
        t.pen, t.pen_on = (int(req.r), int(req.g), int(req.b)), not bool(req.off)
        t.path.append([[round(t.x, 3), round(t.y, 3)]])
        return res
    _world.services[f"/{name}/teleport_absolute"] = (TeleportAbsolute, tele_abs)
    _world.services[f"/{name}/teleport_relative"] = (TeleportRelative, tele_rel)
    _world.services[f"/{name}/set_pen"] = (SetPen, set_pen)

def _srv_spawn(req, res):
    nm = req.name or f"turtle{len(_world.tw) + 1}"
    if nm in _world.tw:
        print(f"[ERROR] [turtlesim]: A turtle named [{nm}] already exists")
        return res
    _world.tw[nm] = _T(nm, req.x, req.y, req.theta)
    _tw_services(nm)
    print(f"[INFO] [turtlesim]: Spawning turtle [{nm}] at x=[{float(req.x):.6f}], y=[{float(req.y):.6f}], theta=[{float(req.theta):.6f}]")
    res.name = nm
    return res
def _srv_kill(req, res):
    _world.tw.pop(req.name, None)
    return res
def _srv_reset(req, res):
    _world.tw.clear(); _world.tw["turtle1"] = _T("turtle1")
    return res
def _srv_clear(req, res):
    for t in _world.tw.values(): t.path = [[[round(t.x, 3), round(t.y, 3)]]]
    return res

_TS_SERVICES = ("/spawn", "/kill", "/reset", "/clear")
def _is_turtle_topic(topic):
    t = _norm(topic)
    return t.endswith("/cmd_vel") and t.count("/") == 2 or t.endswith("/pose") and t.count("/") == 2

_prev_reset6 = _World.reset
def _world_reset6(self):
    _prev_reset6(self)
    self.tw = None
    self.tf = {}
    self.viz = {}
    self.log_once = set()
    self.log_last = {}
_World.reset = _world_reset6
_world.reset()

_prev_cp6 = Node.create_publisher
def _cp6(self, msg_type, topic, qos_profile=10, **kw):
    if msg_type is Twist and _norm(topic).endswith("/cmd_vel") and _norm(topic).count("/") == 2:
        _tw_activate()
    return _prev_cp6(self, msg_type, topic, qos_profile)
Node.create_publisher = _cp6

_prev_cs6 = Node.create_subscription
def _cs6(self, msg_type, topic, callback, qos_profile=10, **kw):
    if msg_type is TPose and _norm(topic).endswith("/pose"):
        _tw_activate()
    return _prev_cs6(self, msg_type, topic, callback, qos_profile)
Node.create_subscription = _cs6

_prev_ct6 = Node.create_timer
def _ct6(self, timer_period_sec, callback, **kw):
    return _prev_ct6(self, timer_period_sec, callback)
Node.create_timer = _ct6

_prev_cc6 = Node.create_client
def _cc6(self, srv_type, srv_name, **kw):
    n = _norm(srv_name)
    if n in _TS_SERVICES or n.endswith(("/teleport_absolute", "/teleport_relative", "/set_pen")):
        _tw_activate()
    return _prev_cc6(self, srv_type, srv_name)
Node.create_client = _cc6

_prev_csrv6 = Node.create_service
def _csrv6(self, srv_type, srv_name, callback, **kw):
    return _prev_csrv6(self, srv_type, srv_name, callback)
Node.create_service = _csrv6

_prev_pub6 = Publisher.publish
def _pub6(self, msg):
    t = _norm(self.topic)
    if isinstance(msg, Twist) and t.endswith("/cmd_vel") and t.count("/") == 2 and _world.tw is not None:
        tur = _world.tw.get(t.split("/")[1])
        if tur is not None:
            tur.advance(_world.time); tur.cmd = Twist(linear=Vector3(msg.linear.x, msg.linear.y, msg.linear.z), angular=Vector3(msg.angular.x, msg.angular.y, msg.angular.z)); tur.since = _world.time; tur.cmd_t0 = _world.time
        if not isinstance(msg, self.msg_type):
            raise TypeError(f"This publisher sends {self.msg_type.__name__} messages, but you gave it {type(msg).__name__}.")
        for cb in list(_world.subs.get(t, [])):
            cb(msg)
        return
    return _prev_pub6(self, msg)
Publisher.publish = _pub6

# ---------------- clock and time ----------------
class _TimeObj:
    def __init__(self, seconds=0.0, nanoseconds=None):
        self.nanoseconds = int(nanoseconds) if nanoseconds is not None else int(round(float(seconds) * 1e9))
    def to_msg(self):
        return Time_(sec=self.nanoseconds // 1_000_000_000, nanosec=self.nanoseconds % 1_000_000_000)
    def seconds_nanoseconds(self):
        return (self.nanoseconds // 1_000_000_000, self.nanoseconds % 1_000_000_000)
    def __sub__(self, other):
        return _DurationObj(nanoseconds=self.nanoseconds - other.nanoseconds)
    def __repr__(self):
        return f"Time(nanoseconds={self.nanoseconds})"
class _DurationObj:
    def __init__(self, seconds=0.0, nanoseconds=None):
        self.nanoseconds = int(nanoseconds) if nanoseconds is not None else int(round(float(seconds) * 1e9))
    def __repr__(self):
        return f"Duration(nanoseconds={self.nanoseconds})"
class _Clock:
    def now(self):
        return _TimeObj(nanoseconds=int(round(_world.time * 1e9)))
Node.get_clock = lambda self: _Clock()
_rclpy.time = _mod("rclpy.time", Time=_TimeObj)
_rclpy.duration = _mod("rclpy.duration", Duration=_DurationObj)

# ---------------- logging levels, once and throttle ----------------
class LoggingSeverity(_enum.IntEnum):
    UNSET, DEBUG, INFO, WARN, ERROR, FATAL = 0, 10, 20, 30, 40, 50
def _log(self, level, label, msg, once=False, throttle_duration_sec=None, skip_first=False):
    key = (self._name, label, str(msg)) if once else (self._name, label)
    if once:
        if key in _world.log_once: return
        _world.log_once.add(key)
    if throttle_duration_sec is not None:
        last = _world.log_last.get(key)
        if last is not None and _world.time - last < float(throttle_duration_sec) - 1e-9: return
        _world.log_last[key] = _world.time
    if level < getattr(self, "_level", 20): return
    print(f"[{label}] [{self._name}]: {msg}")
_Logger.debug = lambda self, msg, **kw: _log(self, 10, "DEBUG", msg, **kw)
_Logger.info = lambda self, msg, **kw: _log(self, 20, "INFO", msg, **kw)
_Logger.warn = lambda self, msg, **kw: _log(self, 30, "WARN", msg, **kw)
_Logger.warning = _Logger.warn
_Logger.error = lambda self, msg, **kw: _log(self, 40, "ERROR", msg, **kw)
_Logger.fatal = lambda self, msg, **kw: _log(self, 50, "FATAL", msg, **kw)
def _set_level(self, level):
    self._level = int(level)
_Logger.set_level = _set_level
_Logger.get_name = lambda self: self._name
_rclpy.logging = _mod("rclpy.logging", LoggingSeverity=LoggingSeverity, get_logger=lambda name: _Logger(name))
_prev_node_init6 = Node.__init__
def _node_init6(self, node_name, namespace=None, **kw):
    _prev_node_init6(self, node_name)
    self._ns = "/" + namespace.strip("/") if namespace else ""
    lvl = _world.overrides.get("__log_level")
    if lvl: self._logger.set_level({"debug": 10, "info": 20, "warn": 30, "error": 40, "fatal": 50}[str(lvl).lower()])
Node.__init__ = _node_init6
Node.get_namespace = lambda self: self._ns or "/"
Node.get_fully_qualified_name = lambda self: f"{self._ns}/{self._node_name}"

# ---------------- executors and callback groups ----------------
class _Executor:
    def __init__(self, num_threads=None):
        self.nodes = []
    def add_node(self, node):
        self.nodes.append(node)
    def spin(self):
        _rclpy.spin(self.nodes[0] if self.nodes else None)
    def spin_once(self, timeout_sec=None):
        _rclpy.spin_once(None)
    def shutdown(self):
        pass
class SingleThreadedExecutor(_Executor): pass
class MultiThreadedExecutor(_Executor): pass
class MutuallyExclusiveCallbackGroup: pass
class ReentrantCallbackGroup: pass
_rclpy.executors = _mod("rclpy.executors", SingleThreadedExecutor=SingleThreadedExecutor, MultiThreadedExecutor=MultiThreadedExecutor, ExternalShutdownException=type("ExternalShutdownException", (Exception,), {}))
_rclpy.callback_groups = _mod("rclpy.callback_groups", MutuallyExclusiveCallbackGroup=MutuallyExclusiveCallbackGroup, ReentrantCallbackGroup=ReentrantCallbackGroup)

# ---------------- tf2 (broadcaster, static broadcaster, buffer + listener) ----------------
def _qmul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return (aw*bx + ax*bw + ay*bz - az*by, aw*by - ax*bz + ay*bw + az*bx, aw*bz + ax*by - ay*bx + az*bw, aw*bw - ax*bx - ay*by - az*bz)
def _qrot(q, v):
    x, y, z, w = _qmul(_qmul(q, (v[0], v[1], v[2], 0.0)), (-q[0], -q[1], -q[2], q[3]))
    return (x, y, z)
def _tinv(T):
    p, q = T; qi = (-q[0], -q[1], -q[2], q[3]); r = _qrot(qi, p)
    return ((-r[0], -r[1], -r[2]), qi)
def _tmul(A, B):
    (pa, qa), (pb, qb) = A, B; r = _qrot(qa, pb)
    return ((pa[0] + r[0], pa[1] + r[1], pa[2] + r[2]), _qmul(qa, qb))
class TransformException(Exception): pass
class LookupException(TransformException): pass
def _send_tf(transforms):
    for t in (transforms if isinstance(transforms, (list, tuple)) else [transforms]):
        if not isinstance(t, TransformStamped):
            raise TypeError("sendTransform() needs a geometry_msgs.msg.TransformStamped")
        if not t.header.frame_id or not t.child_frame_id:
            raise TransformException("A transform needs both header.frame_id (the parent) and child_frame_id.")
        tr, ro = t.transform.translation, t.transform.rotation
        _world.tf[t.child_frame_id] = (t.header.frame_id, ((tr.x, tr.y, tr.z), (ro.x, ro.y, ro.z, ro.w)))
class TransformBroadcaster:
    def __init__(self, node, qos=None): node._check()
    def sendTransform(self, transform): _send_tf(transform)
class StaticTransformBroadcaster(TransformBroadcaster): pass
class Buffer:
    def __init__(self, *a, **kw): pass
    def _to_root(self, frame):
        T, seen = ((0.0, 0.0, 0.0), (0.0, 0.0, 0.0, 1.0)), set()
        while frame in _world.tf:
            if frame in seen: raise TransformException("loop in the tf tree")
            seen.add(frame); parent, Tp = _world.tf[frame]
            T = _tmul(Tp, T); frame = parent
        return frame, T
    def can_transform(self, target, source, time=None, timeout=None):
        try: self.lookup_transform(target, source, time); return True
        except TransformException: return False
    def lookup_transform(self, target_frame, source_frame, time=None, timeout=None):
        known = set(_world.tf) | {p for p, _ in _world.tf.values()}
        for f in (target_frame, source_frame):
            if f not in known:
                raise LookupException(f'"{f}" passed to lookupTransform argument {"target_frame" if f == target_frame else "source_frame"} does not exist. ')
        r1, Tt = self._to_root(target_frame); r2, Ts = self._to_root(source_frame)
        if r1 != r2: raise TransformException(f"Could not find a connection between '{target_frame}' and '{source_frame}' because they are not part of the same tree.")
        p, q = _tmul(_tinv(Tt), Ts)
        out = TransformStamped(); out.header.frame_id = target_frame; out.child_frame_id = source_frame
        out.header.stamp = _Clock().now().to_msg()
        out.transform.translation = Vector3(p[0], p[1], p[2]); out.transform.rotation = Quaternion(x=q[0], y=q[1], z=q[2], w=q[3])
        return out
class TransformListener:
    def __init__(self, buffer, node, **kw): node._check()
_tf2 = _mod("tf2_ros", TransformBroadcaster=TransformBroadcaster, StaticTransformBroadcaster=StaticTransformBroadcaster, Buffer=Buffer,
            TransformListener=TransformListener, TransformException=TransformException, LookupException=LookupException)
_mod("tf2_ros.buffer", Buffer=Buffer); _mod("tf2_ros.transform_listener", TransformListener=TransformListener)
_mod("tf2_ros.transform_broadcaster", TransformBroadcaster=TransformBroadcaster); _mod("tf2_ros.static_transform_broadcaster", StaticTransformBroadcaster=StaticTransformBroadcaster)

# ---------------- spin (timers, turtlesim ticks, message queue) ----------------
def _spin6(node=None):
    if _world.in_cb:
        raise RuntimeError(_DEADLOCK.format(what="rclpy.spin()"))
    if not _world.ok:
        raise RuntimeError("Call rclpy.init() before rclpy.spin().")
    _flush()
    end = _world.time + SIM_SECONDS
    while True:
        active = [t for t in _world.timers if not t.cancelled]
        user = [t for t in active if not isinstance(t, _Tick)]
        if not active or (not user and not _world.subs and _world.tw is None):
            break
        t = min(active, key=lambda x: x.next)
        if t.next > end + 1e-9:
            break
        _world.time = t.next
        t.callback()
        t.next += t.period
        _flush()
    _world.time = end
    if _world.tw is not None:
        for t in _world.tw.values():
            t.advance(end)
            print(f"[turtlesim] {t.name} is now at x={t.x:.2f}, y={t.y:.2f}, theta={t.theta:.2f}")
    print(f"--- practice simulator: stopped after {SIM_SECONDS:g} seconds (real ROS 2 keeps spinning until Ctrl+C) ---")
_rclpy.spin = _spin6

def _set_sim_seconds(s):
    global SIM_SECONDS
    SIM_SECONDS = float(s)
    _rclpy.SIM_SECONDS = SIM_SECONDS

# ---------------- drawings for the playground ----------------
def draw_arm(lengths, angles, target=None, base=None, label=None):
    """Only for the playground: draws a planar arm (link lengths in m, joint angles in rad)."""
    _world.viz.setdefault("arms", []).append({"l": [float(v) for v in lengths], "q": [float(v) for v in angles],
        "target": [float(target[0]), float(target[1])] if target else None,
        "base": [float(v) for v in base] if base else None, "label": label})
def draw_path(points, label=None):
    """Only for the playground: draws a path of (x, y) points in metres."""
    _world.viz.setdefault("paths", []).append({"pts": [[round(float(p[0]), 3), round(float(p[1]), 3)] for p in points], "label": label})
def _emit_viz():
    v = dict(_world.viz)
    if _world.tw:
        v["turtles"] = [{"name": t.name, "x": t.x, "y": t.y, "theta": t.theta, "pen": list(t.pen), "path": t.path} for t in _world.tw.values()]
    if v:
        print("@@VIZ " + _json.dumps(v))

# ---------------- modules ----------------
_gm_msg.Point, _gm_msg.Quaternion, _gm_msg.Pose, _gm_msg.Pose2D, _gm_msg.PoseStamped = Point, Quaternion, Pose, Pose2D, PoseStamped
_gm_msg.PointStamped, _gm_msg.Transform, _gm_msg.TransformStamped, _gm_msg.TwistStamped = PointStamped, Transform, TransformStamped, TwistStamped
_gm_msg.PoseWithCovariance, _gm_msg.TwistWithCovariance = PoseWithCovariance, TwistWithCovariance
_std_msg.Header = Header
_mod("builtin_interfaces"); sys.modules["builtin_interfaces"].msg = _mod("builtin_interfaces.msg", Time=Time_, Duration=Duration_)
_mod("sensor_msgs"); sys.modules["sensor_msgs"].msg = _mod("sensor_msgs.msg", JointState=JointState)
_mod("nav_msgs"); sys.modules["nav_msgs"].msg = _mod("nav_msgs.msg", Odometry=Odometry)
_mod("trajectory_msgs"); sys.modules["trajectory_msgs"].msg = _mod("trajectory_msgs.msg", JointTrajectory=JointTrajectory, JointTrajectoryPoint=JointTrajectoryPoint)
_ts = _mod("turtlesim"); _ts.msg = _mod("turtlesim.msg", Pose=TPose)
_ts.srv = _mod("turtlesim.srv", Spawn=Spawn, Kill=Kill, TeleportAbsolute=TeleportAbsolute, TeleportRelative=TeleportRelative, SetPen=SetPen)
_ss_srv.Empty = Empty
_mri.srv.GoTo, _mri.srv.MoveArm = GoTo, MoveArm
_mri.msg.RobotStatus = RobotStatus
_mri.action.DriveDistance = DriveDistance
_pr = sys.modules["practice"]; _pr.draw_arm, _pr.draw_path = draw_arm, draw_path

# Week 5: launch files can be written and inspected in the playground (they describe what to start; nothing is started here)
class _LaunchDescription:
    def __init__(self, entities=None):
        self.entities = list(entities or [])
    def add_action(self, action):
        self.entities.append(action)
class _LaunchNode:
    def __init__(self, package=None, executable=None, name=None, namespace=None, output=None, parameters=None, remappings=None, arguments=None, **kw):
        if not package or not executable:
            raise TypeError("Node() needs package='...' and executable='...'")
        self.package, self.executable, self.name, self.namespace = package, executable, name, namespace
        self.output, self.parameters, self.remappings, self.arguments = output, list(parameters or []), list(remappings or []), list(arguments or [])
    def __repr__(self):
        return f"Node(package='{self.package}', executable='{self.executable}')"
_mod("launch", LaunchDescription=_LaunchDescription)
sys.modules["launch_ros"] = _mod("launch_ros")
sys.modules["launch_ros"].actions = _mod("launch_ros.actions", Node=_LaunchNode)

# v7: client.call() inside a callback is fine with a MultiThreadedExecutor when the client has its OWN callback group
_world.mt = False
_prev_mt_spin = MultiThreadedExecutor.spin
def _mt_spin(self):
    _world.mt = True
    try:
        _prev_mt_spin(self)
    finally:
        _world.mt = False
MultiThreadedExecutor.spin = _mt_spin
_prev_cc7 = Node.create_client
def _cc7(self, srv_type, srv_name, **kw):
    c = _prev_cc7(self, srv_type, srv_name)
    c._group = kw.get("callback_group")
    return c
Node.create_client = _cc7
_prev_ct7 = Node.create_timer
def _ct7(self, timer_period_sec, callback, **kw):
    group = kw.get("callback_group")
    def run(*a, _cb=callback, _g=group):
        old = getattr(_world, "cur_group", None)
        _world.cur_group = _g
        try:
            return _cb(*a)
        finally:
            _world.cur_group = old
    return _prev_ct7(self, timer_period_sec, run)
Node.create_timer = _ct7
def _client_call7(self, request):
    g = getattr(self, "_group", None)
    if _world.in_cb and _world.mt and g is not None and g is not getattr(_world, "cur_group", None):
        return _orig_client_call(self, request)          # another thread can deliver the answer
    if _world.in_cb and not _world.mt:
        raise RuntimeError(_DEADLOCK.format(what="client.call()") + " (Or: give the client its own callback group "
                           "and spin with a MultiThreadedExecutor.)")
    return _client_call2(self, request)
Client.call = _client_call7

# ---------------- v7: descriptors, try_shutdown, more interfaces ----------------
class FloatingPointRange:
    def __init__(self, from_value=0.0, to_value=0.0, step=0.0):
        self.from_value, self.to_value, self.step = from_value, to_value, step
class IntegerRange:
    def __init__(self, from_value=0, to_value=0, step=0):
        self.from_value, self.to_value, self.step = from_value, to_value, step
class ParameterDescriptor:
    def __init__(self, name="", type=0, description="", additional_constraints="", read_only=False,
                 dynamic_typing=False, floating_point_range=None, integer_range=None):
        self.name, self.type, self.description = name, type, description
        self.additional_constraints, self.read_only, self.dynamic_typing = additional_constraints, read_only, dynamic_typing
        self.floating_point_range = list(floating_point_range or [])
        self.integer_range = list(integer_range or [])
_rim = sys.modules["rcl_interfaces.msg"]
_rim.ParameterDescriptor, _rim.FloatingPointRange, _rim.IntegerRange = ParameterDescriptor, FloatingPointRange, IntegerRange

_prev_declare7 = Node.declare_parameter
def _declare7(self, name, value=None, descriptor=None, ignore_override=False):
    p = _prev_declare7(self, name, value, descriptor, ignore_override)
    self.__dict__.setdefault("_descr", {})[name] = descriptor
    return p
Node.declare_parameter = _declare7

def _declare_parameters7(self, namespace, parameters, ignore_override=False):
    out = []
    for item in parameters:
        name, value = item[0], (item[1] if len(item) > 1 else None)
        full = f"{namespace}.{name}" if namespace else name
        out.append(self.declare_parameter(full, value, item[2] if len(item) > 2 else None, ignore_override))
    return out
Node.declare_parameters = _declare_parameters7

def _describe_check(self, plist):
    for q in plist:
        d = self.__dict__.get("_descr", {}).get(q.name)
        if d is None:
            continue
        if d.read_only:
            return f"Trying to set a read-only parameter: {q.name}."
        if d.floating_point_range and isinstance(q.value, (int, float)):
            r = d.floating_point_range[0]
            if not (r.from_value <= q.value <= r.to_value):
                return f"Parameter {q.name} out of range Min: {r.from_value}, Max: {r.to_value}, value: {q.value}"
        if d.integer_range and isinstance(q.value, int):
            r = d.integer_range[0]
            if not (r.from_value <= q.value <= r.to_value):
                return f"Parameter {q.name} out of range Min: {r.from_value}, Max: {r.to_value}, value: {q.value}"
    return None

_prev_set7 = Node.set_parameters
def _set_parameters7(self, params):
    out = []
    for p in params:
        why = _describe_check(self, [p]) if p.name in self._params else None
        if why:
            out.append(SetParametersResult(successful=False, reason=why))
        else:
            out.extend(_prev_set7(self, [p]))
    return out
Node.set_parameters = _set_parameters7

def try_shutdown(context=None):
    if _world.ok:
        shutdown()
_rclpy.try_shutdown = try_shutdown

def _node_destroy_timer(self, timer):
    timer.cancel()
    return True
Node.destroy_timer = _node_destroy_timer
Node.destroy_publisher = lambda self, pub: True
Node.destroy_subscription = lambda self, sub: True

def _time_from_msg(msg):
    return _TimeObj(seconds=msg.sec + msg.nanosec / 1e9)
_TimeObj.from_msg = staticmethod(_time_from_msg)
_rclpy._emit_viz, _rclpy._set_sim_seconds = _emit_viz, _set_sim_seconds

# ===================== visualization_msgs + interactive_markers (Week 9) =====================
ColorRGBA = _plain_msg("std_msgs/msg/ColorRGBA", [("r", float), ("g", float), ("b", float), ("a", float)])
_V3 = Vector3
class Marker(_plain_msg("visualization_msgs/msg/Marker", [("header", Header), ("ns", str), ("id", int), ("type", int), ("action", int), ("pose", Pose), ("scale", _V3),
        ("color", ColorRGBA), ("lifetime", Duration_), ("frame_locked", bool), ("points", list), ("colors", list), ("text", str), ("mesh_resource", str), ("mesh_use_embedded_materials", bool)])):
    ARROW, CUBE, SPHERE, CYLINDER, LINE_STRIP, LINE_LIST, CUBE_LIST, SPHERE_LIST, POINTS, TEXT_VIEW_FACING, MESH_RESOURCE, TRIANGLE_LIST, ARROW_STRIP = range(13)
    ADD, MODIFY, DELETE, DELETEALL = 0, 0, 2, 3
MarkerArray = _plain_msg("visualization_msgs/msg/MarkerArray", [("markers", list)])
class InteractiveMarkerControl(_plain_msg("visualization_msgs/msg/InteractiveMarkerControl", [("name", str), ("orientation", Quaternion), ("orientation_mode", int), ("interaction_mode", int),
        ("always_visible", bool), ("markers", list), ("independent_marker_orientation", bool), ("description", str)])):
    INHERIT, FIXED, VIEW_FACING = 0, 1, 2
    NONE, MENU, BUTTON, MOVE_AXIS, MOVE_PLANE, ROTATE_AXIS, MOVE_ROTATE, MOVE_3D, ROTATE_3D, MOVE_ROTATE_3D = range(10)
InteractiveMarker = _plain_msg("visualization_msgs/msg/InteractiveMarker", [("header", Header), ("pose", Pose), ("name", str), ("description", str), ("scale", lambda: 1.0), ("menu_entries", list), ("controls", list)])
class InteractiveMarkerFeedback(_plain_msg("visualization_msgs/msg/InteractiveMarkerFeedback", [("header", Header), ("client_id", str), ("marker_name", str), ("control_name", str), ("event_type", int),
        ("pose", Pose), ("menu_entry_id", int), ("mouse_point", Point), ("mouse_point_valid", bool)])):
    KEEP_ALIVE, POSE_UPDATE, MENU_SELECT, BUTTON_CLICK, MOUSE_DOWN, MOUSE_UP = range(6)

def _todict(o):
    if isinstance(o, (list, tuple)):
        return [_todict(x) for x in o]
    if hasattr(o, "_fields"):
        return {f: _todict(getattr(o, f)) for f in o._fields}
    if isinstance(o, bool) or o is None or isinstance(o, (int, float, str)):
        return o
    if hasattr(o, "__dict__"):
        return {k: _todict(v) for k, v in vars(o).items() if not k.startswith("_")}
    return str(o)

_orig_publish_viz = Publisher.publish
def _publish_viz(self, msg):
    if isinstance(msg, Marker):
        d = _todict(msg); d["__topic"] = _norm(self.topic)
        _world.viz.setdefault("markers", []).append(d)
    elif isinstance(msg, MarkerArray):
        for m in msg.markers:
            if not isinstance(m, Marker):
                raise TypeError("MarkerArray.markers must contain Marker messages")
            d = _todict(m); d["__topic"] = _norm(self.topic)
            _world.viz.setdefault("markers", []).append(d)
    return _orig_publish_viz(self, msg)

# the ROS graph the playground's RViz sees: every topic a node publishes (name -> message type)
_TYPE_NAMES = {"Twist": "geometry_msgs/msg/Twist", "Vector3": "geometry_msgs/msg/Vector3", "String": "std_msgs/msg/String", "Int32": "std_msgs/msg/Int32",
               "Int64": "std_msgs/msg/Int64", "Float64": "std_msgs/msg/Float64", "Float32": "std_msgs/msg/Float32", "Bool": "std_msgs/msg/Bool"}
def _note_topic(topic, msg_type):
    name = getattr(msg_type, "_full", None) or _TYPE_NAMES.get(getattr(msg_type, "__name__", ""), "")
    if name:
        _world.viz.setdefault("topics", {})[_norm(topic)] = name
_orig_pub_init = Publisher.__init__
def _pub_init(self, msg_type, topic):
    _orig_pub_init(self, msg_type, topic)
    _note_topic(topic, msg_type)
Publisher.__init__ = _pub_init
Publisher.publish = _publish_viz

class InteractiveMarkerServer:
    def __init__(self, node, namespace):
        node._check()
        self.node, self.namespace = node, namespace
        self._pending, self._live, self._cbs, self._menus = {}, {}, {}, {}
        _world.viz.setdefault("topics", {})[_norm(namespace) + "/update"] = "visualization_msgs/msg/InteractiveMarkerUpdate"
        _world.viz.setdefault("topics", {})[_norm(namespace) + "/feedback"] = "visualization_msgs/msg/InteractiveMarkerFeedback"
        _world.im_servers = getattr(_world, "im_servers", [])
        _world.im_servers.append(self)
    def insert(self, marker, *, feedback_callback=None, feedback_type=None):
        if not isinstance(marker, InteractiveMarker):
            raise TypeError("insert() needs an InteractiveMarker")
        if not marker.name:
            raise ValueError("The interactive marker needs a name")
        self._pending[marker.name] = marker
        if feedback_callback is not None:
            self._cbs[marker.name] = feedback_callback
    def setPose(self, name, pose, header=None):
        m = self._pending.get(name) or self._live.get(name)
        if m is None:
            return False
        m.pose = pose
        self._pending[name] = m
        return True
    def erase(self, name):
        self._pending[name] = None
        return True
    def clear(self):
        for n in list(self._live) + list(self._pending):
            self._pending[n] = None
    def get(self, name):
        return self._live.get(name)
    def setCallback(self, name, feedback_callback, feedback_type=None):
        self._cbs[name] = feedback_callback
        return True
    def applyChanges(self):
        for n, m in self._pending.items():
            if m is None:
                self._live.pop(n, None)
            else:
                self._live[n] = m
        self._pending = {}
        ims = []
        for s in _world.im_servers:
            for n, m in s._live.items():
                d = _todict(m)
                d["menu"] = [{"id": i, "title": t} for i, t, _ in s._menus.get(n, [])]
                d["__ns"] = _norm(s.namespace)
                ims.append(d)
        _world.viz["imarkers"] = ims
    def _feedback(self, fb):
        m = self._live.get(fb.marker_name)
        if m is None:
            return
        if fb.event_type in (InteractiveMarkerFeedback.POSE_UPDATE, InteractiveMarkerFeedback.MOUSE_UP):
            m.pose = fb.pose
        if fb.event_type == InteractiveMarkerFeedback.MENU_SELECT:
            for i, t, cb in self._menus.get(fb.marker_name, []):
                if i == fb.menu_entry_id and cb is not None:
                    cb(fb)
        cb = self._cbs.get(fb.marker_name)
        if cb is not None:
            cb(fb)

class MenuHandler:
    def __init__(self):
        self._entries = []
    def insert(self, title, *, parent=None, command_type=0, command="", callback=None):
        self._entries.append((len(self._entries) + 1, title, callback))
        return len(self._entries)
    def apply(self, server, marker_name):
        server._menus[marker_name] = list(self._entries)
        return True
    def reApply(self, server):
        return True

def _im_feedback(js):
    d = _json.loads(js)
    p, q = d["pose"]["position"], d["pose"]["orientation"]
    fb = InteractiveMarkerFeedback()
    fb.marker_name = d["name"]
    fb.event_type = {"MOUSE_UP": 5, "MENU_SELECT": 2, "BUTTON_CLICK": 3, "POSE_UPDATE": 1}.get(d["event"], 1)
    fb.pose = Pose(position=Point(x=float(p["x"]), y=float(p["y"]), z=float(p["z"])), orientation=Quaternion(x=float(q["x"]), y=float(q["y"]), z=float(q["z"]), w=float(q["w"])))
    fb.menu_entry_id = int(d.get("menu_entry_id", 0))
    fb.header.frame_id = d.get("frame", "map")
    for s in getattr(_world, "im_servers", []):
        if fb.marker_name in s._live:
            if fb.event_type == 5:
                print(f"(you released the marker at x={p['x']:.2f}, y={p['y']:.2f}, z={p['z']:.2f})")
            s._feedback(fb)
            s.applyChanges()

_orig_world_reset_viz = _World.reset
def _world_reset_viz(self):
    _orig_world_reset_viz(self)
    self.im_servers = []
_World.reset = _world_reset_viz
_world.im_servers = []
_mod("visualization_msgs"); sys.modules["visualization_msgs"].msg = _mod("visualization_msgs.msg", Marker=Marker, MarkerArray=MarkerArray, InteractiveMarker=InteractiveMarker,
    InteractiveMarkerControl=InteractiveMarkerControl, InteractiveMarkerFeedback=InteractiveMarkerFeedback)
sys.modules["std_msgs.msg"].ColorRGBA = ColorRGBA
if not hasattr(sys.modules["geometry_msgs.msg"], "Vector3"):
    sys.modules["geometry_msgs.msg"].Vector3 = _V3
_mod("interactive_markers", InteractiveMarkerServer=InteractiveMarkerServer, MenuHandler=MenuHandler)
sys.modules["interactive_markers"].interactive_marker_server = _mod("interactive_markers.interactive_marker_server", InteractiveMarkerServer=InteractiveMarkerServer)
sys.modules["interactive_markers"].menu_handler = _mod("interactive_markers.menu_handler", MenuHandler=MenuHandler)
_rclpy._im_feedback = _im_feedback
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
  if (e.data.type === "imfb") {   // an interactive marker was dragged or clicked in the 3D view
    try {
      if (!pyodide) throw new Error("Run the program first.");
      pyodide.globals.set("_fb_json", JSON.stringify(e.data.fb));
      pyodide.runPython("import rclpy as _r\n_r._im_feedback(_fb_json)\n_r._emit_viz()");
      postMessage({ id, type: "done" });
    } catch (err) { postMessage({ id, type: "error", text: String((err && err.message) || err) }); }
    return;
  }
  inputs = Array.isArray(e.data.inputs) ? e.data.inputs.slice() : [];
  try {
    if (!pyodide) { postMessage({ id, type: "status", text: "Starting Python (first time only, about 5–15 seconds)…" }); await boot(); }
    postMessage({ id, type: "status", text: "" });
    pyodide.globals.set("_overrides_json", JSON.stringify(e.data.params || {}));
    pyodide.runPython("import json as _j, rclpy as _r\n_r._world_overrides = _j.loads(_overrides_json)\n_r._reset()");
    pyodide.runPython(`import rclpy as _r\n_r._set_sim_seconds(${Number(e.data.simSeconds) || 3})`);
    const ns = pyodide.globals.get("dict")();
    ns.set("__name__", "__main__");
    await pyodide.runPythonAsync(code, { globals: ns });
    ns.destroy();
    pyodide.runPython("import rclpy as _r\n_r._emit_viz()");
    postMessage({ id, type: "done" });
  } catch (err) {
    postMessage({ id, type: "error", text: String((err && err.message) || err) });
  }
};
