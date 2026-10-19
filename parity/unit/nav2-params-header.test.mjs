// nav2_params.json of each TurtleBot3 model: values equal the installed turtlebot3_navigation2 param file
// (parity/fixtures/_installed), and the header cites that file and the package version (parity/fixtures/_installed/dpkg_versions.txt).
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const yaml = (p) => JSON.parse(execFileSync("python3", ["-I", "-c", "import json,sys,yaml;print(json.dumps(yaml.safe_load(open(sys.argv[1]))))", p], { encoding: "utf8" }));
const deb = fs.readFileSync("parity/fixtures/_installed/dpkg_versions.txt", "utf8").match(/^ros-jazzy-turtlebot3-navigation2 (\S+)$/m)[1];

describe("nav2_params.json headers (turtlebot3_navigation2)", () => {
  for (const model of ["burger", "waffle", "waffle_pi"]) {
    it(`tb3_${model}: values = installed ${model}.yaml, header cites it and version ${deb.split("-")[0]}`, () => {
      const data = JSON.parse(fs.readFileSync(`public/robots/tb3_${model}/nav2_params.json`, "utf8"));
      const { _header: h, ...values } = data;
      expect(values).toEqual(yaml(`parity/fixtures/_installed/turtlebot3_navigation2/param/${model}.yaml`));
      expect(h.package).toBe("turtlebot3_navigation2");
      expect(h.source_file).toBe(`/opt/ros/jazzy/share/turtlebot3_navigation2/param/${model}.yaml`);
      expect(h.version).toBe(deb.split("-")[0]);
      expect(h.deb_version).toBe(deb);
    });
  }
});
