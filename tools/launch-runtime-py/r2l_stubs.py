# ROS2Lab launch runtime: stand-ins for the compiled ROS 2 packages (rclpy, lifecycle_msgs, composition_interfaces...)
# that launch / launch_ros import. A launch *description* never needs a real DDS participant; the runtime replaces the
# few places that would talk to ROS (LoadComposableNodes, lifecycle ChangeState) with calls to the website's simulator.
# Constants carry the real values from the .msg definitions; name validation follows rmw's rules and messages.
import enum
import importlib.abc
import importlib.machinery
import os
import re
import sys
import types


def _module(name, **attrs):
    m = types.ModuleType(name)
    m.__dict__.update(attrs)
    m.__r2l_stub__ = True
    sys.modules[name] = m
    parent, _, child = name.rpartition(".")
    if parent:
        setattr(sys.modules[parent], child, m)
    return m


class _Msg:
    """Plain message object: fields given as keyword arguments, unknown fields read as None."""
    _fields = ()

    def __init__(self, **kw):
        for f, default in self._fields:
            setattr(self, f, default() if callable(default) else default)
        self.__dict__.update(kw)

    def __repr__(self):
        return "{}({})".format(type(self).__name__, ", ".join(f"{k}={v!r}" for k, v in self.__dict__.items()))


# ---------------------------------------------------------------- lifecycle_msgs
class Transition(_Msg):
    _fields = (("id", 0), ("label", ""))
    TRANSITION_CREATE = 0
    TRANSITION_CONFIGURE = 1
    TRANSITION_CLEANUP = 2
    TRANSITION_ACTIVATE = 3
    TRANSITION_DEACTIVATE = 4
    TRANSITION_UNCONFIGURED_SHUTDOWN = 5
    TRANSITION_INACTIVE_SHUTDOWN = 6
    TRANSITION_ACTIVE_SHUTDOWN = 7
    TRANSITION_DESTROY = 8
    TRANSITION_ON_CONFIGURE_SUCCESS = 10
    TRANSITION_ON_CONFIGURE_FAILURE = 11
    TRANSITION_ON_CONFIGURE_ERROR = 12
    TRANSITION_ON_CLEANUP_SUCCESS = 20
    TRANSITION_ON_CLEANUP_FAILURE = 21
    TRANSITION_ON_CLEANUP_ERROR = 22
    TRANSITION_ON_ACTIVATE_SUCCESS = 30
    TRANSITION_ON_ACTIVATE_FAILURE = 31
    TRANSITION_ON_ACTIVATE_ERROR = 32
    TRANSITION_ON_DEACTIVATE_SUCCESS = 40
    TRANSITION_ON_DEACTIVATE_FAILURE = 41
    TRANSITION_ON_DEACTIVATE_ERROR = 42
    TRANSITION_ON_SHUTDOWN_SUCCESS = 50
    TRANSITION_ON_SHUTDOWN_FAILURE = 51
    TRANSITION_ON_SHUTDOWN_ERROR = 52
    TRANSITION_ON_ERROR_SUCCESS = 60
    TRANSITION_ON_ERROR_FAILURE = 61
    TRANSITION_ON_ERROR_ERROR = 62
    TRANSITION_CALLBACK_SUCCESS = 97
    TRANSITION_CALLBACK_FAILURE = 98
    TRANSITION_CALLBACK_ERROR = 99


class State(_Msg):
    _fields = (("id", 0), ("label", ""))
    PRIMARY_STATE_UNKNOWN = 0
    PRIMARY_STATE_UNCONFIGURED = 1
    PRIMARY_STATE_INACTIVE = 2
    PRIMARY_STATE_ACTIVE = 3
    PRIMARY_STATE_FINALIZED = 4
    TRANSITION_STATE_CONFIGURING = 10
    TRANSITION_STATE_CLEANINGUP = 11
    TRANSITION_STATE_SHUTTINGDOWN = 12
    TRANSITION_STATE_ACTIVATING = 13
    TRANSITION_STATE_DEACTIVATING = 14
    TRANSITION_STATE_ERRORPROCESSING = 15


class TransitionEvent(_Msg):
    _fields = (("timestamp", 0), ("transition", Transition), ("start_state", State), ("goal_state", State))


class _ChangeStateRequest(_Msg):
    _fields = (("transition", Transition),)


class _ChangeStateResponse(_Msg):
    _fields = (("success", True),)


_module("lifecycle_msgs")
_module("lifecycle_msgs.msg", Transition=Transition, State=State, TransitionEvent=TransitionEvent)
_module("lifecycle_msgs.srv", ChangeState=type("ChangeState", (), {"Request": _ChangeStateRequest, "Response": _ChangeStateResponse}),
        GetState=type("GetState", (), {}))


# ---------------------------------------------------------------- composition_interfaces
class _LoadNodeRequest(_Msg):
    _fields = (("package_name", ""), ("plugin_name", ""), ("node_name", ""), ("node_namespace", ""), ("log_level", 0),
               ("remap_rules", list), ("parameters", list), ("extra_arguments", list))


class _LoadNodeResponse(_Msg):
    _fields = (("success", True), ("error_message", ""), ("full_node_name", ""), ("unique_id", 0))


_module("composition_interfaces")
_module("composition_interfaces.srv", LoadNode=type("LoadNode", (), {"Request": _LoadNodeRequest, "Response": _LoadNodeResponse}),
        UnloadNode=type("UnloadNode", (), {}), ListNodes=type("ListNodes", (), {}))


# ---------------------------------------------------------------- rclpy
class NameValidationException(Exception):
    def __init__(self, name_type, name, error_msg, invalid_index):
        msg = "Invalid {name_type}: {error_msg}:\n  '{name}'\n   {indent}^".format(
            name_type=name_type, name=name, error_msg=error_msg, indent=" " * invalid_index)
        super().__init__(msg)


class InvalidNodeNameException(NameValidationException):
    def __init__(self, *args):
        super().__init__("node name", *args)


class InvalidNamespaceException(NameValidationException):
    def __init__(self, *args):
        super().__init__("namespace", *args)


class InvalidTopicNameException(NameValidationException):
    def __init__(self, *args):
        super().__init__("topic name", *args)


def validate_node_name(node_name):
    """rmw_validate_node_name: same checks and messages."""
    if not node_name:
        raise InvalidNodeNameException(node_name, "node name must not be empty", 0)
    m = re.search(r"[^A-Za-z0-9_]", node_name)
    if m:
        raise InvalidNodeNameException(
            node_name, "node name must not contain characters other than alphanumerics or '_'", m.start())
    if node_name[0].isdigit():
        raise InvalidNodeNameException(node_name, "node name must not start with a number", 0)
    if len(node_name) > 255:
        raise InvalidNodeNameException(node_name, "node name length should not exceed '255'", 254)
    return True


def validate_namespace(namespace):
    """rmw_validate_namespace: same checks and messages."""
    if not namespace:
        raise InvalidNamespaceException(namespace, "namespace must not be empty", 0)
    if namespace[0] != "/":
        raise InvalidNamespaceException(namespace, "namespace must be absolute, it must lead with a '/'", 0)
    if len(namespace) > 1 and namespace.endswith("/"):
        raise InvalidNamespaceException(namespace, "namespace must not end with a '/', unless only a '/'", len(namespace) - 1)
    m = re.search(r"[^A-Za-z0-9_/]", namespace)
    if m:
        raise InvalidNamespaceException(
            namespace, "namespace must not contain characters other than alphanumerics, '_', or '/'", m.start())
    i = namespace.find("//")
    if i >= 0:
        raise InvalidNamespaceException(namespace, "namespace must not contain repeated '/'", i + 1)
    for m in re.finditer(r"/([^/]*)", namespace):
        if m.group(1)[:1].isdigit():
            raise InvalidNamespaceException(namespace, "namespace must not have a token that starts with a number", m.start(1))
    if len(namespace) > 245:
        raise InvalidNamespaceException(namespace, "namespace should not exceed '245' characters", 244)
    return True


class _ParameterType(enum.IntEnum):
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

    @classmethod
    def from_parameter_value(cls, v):
        for t in cls:
            if t.check(v):
                return t
        raise TypeError("The given value is not one of the allowed types '{}'.".format(v))

    def check(self, v):  # rclpy.parameter.Parameter.Type.check
        T = _ParameterType
        if self == T.NOT_SET:
            return v is None
        if self == T.BOOL:
            return isinstance(v, bool)
        if self == T.INTEGER:
            return isinstance(v, int) and not isinstance(v, bool)
        if self == T.DOUBLE:
            return isinstance(v, float)
        if self == T.STRING:
            return isinstance(v, str)
        seq = isinstance(v, (list, tuple))
        if self == T.BYTE_ARRAY:
            return seq and len(v) > 0 and all(isinstance(x, bytes) and len(x) == 1 for x in v)
        if self == T.BOOL_ARRAY:
            return seq and all(isinstance(x, bool) for x in v)
        if self == T.INTEGER_ARRAY:
            return seq and all(isinstance(x, int) and not isinstance(x, bool) for x in v)
        if self == T.DOUBLE_ARRAY:
            return seq and all(isinstance(x, float) for x in v)
        if self == T.STRING_ARRAY:
            return seq and all(isinstance(x, str) for x in v)
        return False


class Parameter:
    Type = _ParameterType

    def __init__(self, name, type_=None, value=None):
        if type_ is None:
            type_ = _ParameterType.from_parameter_value(value)
        self.name, self.type_, self.value = name, _ParameterType(type_), value

    def to_parameter_msg(self):  # the runtime only needs name and value
        return _Msg(name=self.name, value=self.value, type=int(self.type_))

    def __repr__(self):
        return f"Parameter({self.name!r}, {self.type_.name}, {self.value!r})"


def get_logging_directory():
    d = os.environ.get("ROS_LOG_DIR")
    if not d:
        d = os.path.join(os.environ.get("ROS_HOME") or os.path.join(os.path.expanduser("~"), ".ros"), "log")
    return os.path.expanduser(d)


class _FakeNode:
    """Stands for the hidden `launch_ros_<pid>` node: subscriptions / clients are inert objects."""

    def __init__(self, name):
        self.name = name

    def get_name(self):
        return self.name

    def create_subscription(self, *a, **k):
        return _Inert()

    def create_client(self, srv_type, srv_name, *a, **k):
        c = _Inert()
        c.srv_name = srv_name
        return c

    def create_publisher(self, *a, **k):
        return _Inert()

    def destroy_node(self):
        pass


class _Inert:
    def __getattr__(self, n):
        if n.startswith("__"):
            raise AttributeError(n)
        return lambda *a, **k: None


class ExternalShutdownException(Exception):
    pass


class _Executor:
    def __init__(self, *a, **k):
        pass

    def add_node(self, *a):
        pass

    def remove_node(self, *a):
        pass

    def spin_once(self, *a, **k):
        pass

    def shutdown(self, *a, **k):
        pass


_module("rclpy", Context=lambda *a, **k: object(), init=lambda *a, **k: None, shutdown=lambda *a, **k: None,
        ok=lambda *a, **k: True, create_node=lambda name, *a, **k: _FakeNode(name))
_module("rclpy.exceptions", NameValidationException=NameValidationException, InvalidNodeNameException=InvalidNodeNameException,
        InvalidNamespaceException=InvalidNamespaceException, InvalidTopicNameException=InvalidTopicNameException)
_module("rclpy.validate_node_name", validate_node_name=validate_node_name)
_module("rclpy.validate_namespace", validate_namespace=validate_namespace)
_module("rclpy.parameter", Parameter=Parameter)
_module("rclpy.logging", get_logging_directory=get_logging_directory)
_module("rclpy.executors", SingleThreadedExecutor=_Executor, MultiThreadedExecutor=_Executor,
        ExternalShutdownException=ExternalShutdownException)
_module("rclpy.node", Node=_FakeNode)
_module("rclpy.qos", QoSProfile=lambda *a, **k: None, qos_profile_system_default=None)


# ---------------------------------------------------------------- lxml (C extension) -> xml.etree for urdf_parser_py
def _install_lxml_fallback():
    try:
        import lxml.etree  # noqa: F401  (Pyodide's real lxml, if the page loaded it)
        return
    except ImportError:
        pass
    # a private, pure-Python copy of xml.etree.ElementTree, whose Element can get lxml's getchildren() (used by
    # urdf_parser_py); the C-accelerated Element of the standard module cannot take new methods
    import importlib.util
    spec = importlib.util.find_spec("xml.etree.ElementTree")
    ET = importlib.util.module_from_spec(spec)
    saved = sys.modules.get("_elementtree", None)
    sys.modules["_elementtree"] = None
    try:
        spec.loader.exec_module(ET)
    finally:
        if saved is None:
            sys.modules.pop("_elementtree", None)
        else:
            sys.modules["_elementtree"] = saved
    ET.Element.getchildren = lambda self: list(self)

    class _Comment:  # xml.etree's default parser drops comments, so isinstance(..., _Comment) is never true
        pass

    def tostring(element, pretty_print=False, encoding=None, xml_declaration=None, **kw):
        if pretty_print:
            import copy
            element = copy.deepcopy(element)
            ET.indent(element)
        uni = encoding in ("unicode", str)
        out = ET.tostring(element, encoding="unicode" if uni or encoding is None else encoding,
                          xml_declaration=xml_declaration)
        if uni:
            return out + ("\n" if pretty_print else "")
        if isinstance(out, str):
            out = out.encode()
        return out + (b"\n" if pretty_print else b"")

    def fromstring(text, parser=None, **kw):
        if isinstance(text, bytes):
            text = text.decode("utf-8")
        return ET.fromstring(text)

    _module("lxml")
    etree = _module("lxml.etree", Element=ET.Element, SubElement=ET.SubElement, ElementTree=ET.ElementTree,
                    _Element=ET.Element, _Comment=_Comment, Comment=ET.Comment, fromstring=fromstring,
                    XML=fromstring, tostring=tostring, parse=ET.parse, XMLParser=lambda *a, **k: None,
                    XMLSyntaxError=ET.ParseError)


_install_lxml_fallback()


# ---------------------------------------------------------------- anything else compiled: inert modules
STUB_ROOTS = {"rcl_interfaces", "builtin_interfaces", "std_msgs", "rosidl_runtime_py", "rcl_logging_interface",
              "rosgraph_msgs", "rmw_implementation"}


class _Dummy:
    def __init__(self, *a, **k):
        pass

    def __call__(self, *a, **k):
        return _Dummy()

    def __getattr__(self, n):
        if n.startswith("__"):
            raise AttributeError(n)
        return _Dummy()

    def __iter__(self):
        return iter(())

    def __bool__(self):
        return False


class _StubModule(types.ModuleType):
    def __getattr__(self, name):
        if name.startswith("__"):
            raise AttributeError(name)
        v = type(name, (_Dummy,), {})
        setattr(self, name, v)
        return v


class _Finder(importlib.abc.MetaPathFinder, importlib.abc.Loader):
    def find_spec(self, fullname, path, target=None):
        if fullname.split(".")[0] in STUB_ROOTS:
            return importlib.machinery.ModuleSpec(fullname, self, is_package=True)

    def create_module(self, spec):
        m = _StubModule(spec.name)
        m.__path__ = []
        return m

    def exec_module(self, m):
        pass


sys.meta_path.insert(0, _Finder())
