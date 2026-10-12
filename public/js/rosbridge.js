// A small rosbridge v2 client (the protocol of rosbridge_server's WebSocket), no libraries needed.
// Start the server on Ubuntu:  sudo apt install ros-jazzy-rosbridge-suite
//                              ros2 launch rosbridge_server rosbridge_websocket_launch.xml
export class Rosbridge {
  constructor(url) { this.url = url; this.ws = null; this.subs = new Map(); this.calls = new Map(); this.adv = new Set(); this.n = 0; this.onclose = null; }
  connect(timeoutMs = 6000) {
    return new Promise((res, rej) => {
      let ws;
      try { ws = new WebSocket(this.url); } catch (e) { rej(e); return; }
      const t = setTimeout(() => { try { ws.close(); } catch { /* ignore */ } rej(new Error("no answer (is rosbridge running?)")); }, timeoutMs);
      ws.onopen = () => { clearTimeout(t); this.ws = ws; res(this); };
      ws.onerror = () => { clearTimeout(t); rej(new Error("could not connect")); };
      ws.onclose = () => { this.ws = null; if (this.onclose) this.onclose(); };
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (m.op === "publish") { for (const cb of this.subs.get(m.topic) || []) cb(m.msg); }
        else if (m.op === "service_response") { const c = this.calls.get(m.id); if (c) { this.calls.delete(m.id); m.result === false ? c.rej(new Error(String(m.values || "service failed"))) : c.res(m.values); } }
      };
    });
  }
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  subscribe(topic, type, cb, extra = {}) {
    if (!this.subs.has(topic)) { this.subs.set(topic, []); this.send({ op: "subscribe", id: `sub_${++this.n}`, topic, type, ...extra }); }
    this.subs.get(topic).push(cb);
  }
  publish(topic, type, msg) {
    if (!this.adv.has(topic)) { this.adv.add(topic); this.send({ op: "advertise", id: `adv_${++this.n}`, topic, type }); }
    this.send({ op: "publish", topic, msg });
  }
  call(service, type, args = {}, timeoutMs = 4000) {
    const id = `call_${++this.n}`;
    return new Promise((res, rej) => { this.calls.set(id, { res, rej }); this.send({ op: "call_service", id, service, type, args }); setTimeout(() => { if (this.calls.has(id)) { this.calls.delete(id); rej(new Error(`${service}: no answer`)); } }, timeoutMs); });
  }
  close() { if (this.ws) this.ws.close(); }
}
