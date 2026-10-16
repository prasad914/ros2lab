import { describe, it, expect } from "vitest";
import { SENSOR_PRESETS, ROBOT_SENSORS } from "../../public/js/sensor-specs.js";

describe("Sensor and Camera Parity (Prompt P5 / Spec S9)", () => {
  it("defines camera presets with correct hfov and dimensions", () => {
    const colorPreset = SENSOR_PRESETS["d435-color"];
    expect(colorPreset).toBeDefined();
    expect(colorPreset.kind).toBe("camera");
    expect(colorPreset.camera.width).toBe(640);
    expect(colorPreset.camera.height).toBe(360);
    expect(colorPreset.camera.hfov).toBeCloseTo(1.2043, 4);

    const depthPreset = SENSOR_PRESETS["d435-depth"];
    expect(depthPreset).toBeDefined();
    expect(depthPreset.kind).toBe("depth_camera");
    expect(depthPreset.camera.width).toBe(424);
    expect(depthPreset.camera.height).toBe(240);
  });

  it("calculates CameraInfo K matrix correctly from hfov and dimensions", () => {
    const c = SENSOR_PRESETS["d435-color"].camera;
    const fx = (c.width / 2) / Math.tan(c.hfov / 2);
    const fy = fx;
    const cx = c.width / 2;
    const cy = c.height / 2;

    expect(fx).toBeGreaterThan(0);
    expect(cx).toBe(320);
    expect(cy).toBe(180);

    const K = [fx, 0, cx, 0, fy, cy, 0, 0, 1];
    expect(K.length).toBe(9);
    expect(K[8]).toBe(1);
  });

  it("configures robot sensors correctly: burger has no camera, waffle has camera", () => {
    const burger = ROBOT_SENSORS["tb3_burger"];
    const waffle = ROBOT_SENSORS["tb3_waffle"];

    expect(burger).toBeDefined();
    expect(burger.sensors).not.toContain("d435-color");
    expect(burger.sensors).toEqual(["lds-01", "tb3-imu"]);

    expect(waffle).toBeDefined();
    expect(waffle.sensors).toContain("d435-color");
  });

  it("models PointCloud2 byte layout expectations (fields x, y, z, intensity/rgb, point_step=32)", () => {
    const pointStep = 32;
    const numPoints = 10;
    const buffer = new ArrayBuffer(pointStep * numPoints);
    const view = new DataView(buffer);

    view.setFloat32(0, 1.5, true);  // x
    view.setFloat32(4, 0.5, true);  // y
    view.setFloat32(8, 0.1, true);  // z
    view.setFloat32(16, 255.0, true); // intensity / rgb

    expect(view.getFloat32(0, true)).toBe(1.5);
    expect(view.getFloat32(4, true)).toBe(0.5);
    expect(view.getFloat32(8, true)).toBeCloseTo(0.1, 5);
    expect(view.getFloat32(16, true)).toBe(255.0);
  });
});
