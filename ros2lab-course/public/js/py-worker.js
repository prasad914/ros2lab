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
                reason = (f"Wrong parameter type, parameter {{{q.name}}} is of type {{{_TNAME.get(int(old.type_), old.type_)}}}, "
                          f"setting it to {{{_TNAME.get(int(q.type_), q.type_)}}} is not allowed.")
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
