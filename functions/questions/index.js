// Collects all question templates and checks they are well-formed.
const terminal = require("./terminal");
const python = require("./python");
const extra = require("./extra");
const ros = require("./ros");
const intro = require("./intro");
const progfund = require("./progfund");
const nodes = require("./nodes");
const urdfviz = require("./urdfviz");

const TEMPLATES = [...terminal, ...python, ...extra, ...ros, ...intro, ...progfund, ...nodes, ...urdfviz];
const ids = new Set();
for (const t of TEMPLATES) {
  if (ids.has(t.id)) throw new Error(`Duplicate question template id: ${t.id}`);
  ids.add(t.id);
  if (!["mcq", "fill", "predict", "order"].includes(t.type)) throw new Error(`Bad type in ${t.id}`);
}
const TOPICS = [...new Set(TEMPLATES.map((t) => t.topic))];

module.exports = { TEMPLATES, TOPICS };
