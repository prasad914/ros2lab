// Readiness checks and robot mission game configuration (Prompt P12)
// A check is passed only when its fixture parity tests passed against real ROS 2 Jazzy (fixture-status.js, generated
// by parity/compare/readiness_from_fixtures.py); a check without such a test keeps its games locked.
import { FIXTURE_STATUS } from "./fixture-status.js";

export const CHECKS = {
  TF: { id: "TF", name: "TF tree complete", status: "NOT YET VALIDATED" },
  FIXED_FRAME: { id: "FIXED_FRAME", name: "Fixed Frame selectable", status: "NOT YET VALIDATED" },
  SENS: { id: "SENS", name: "Required sensor topics", status: "NOT YET VALIDATED" },
  SLAM: { id: "SLAM", name: "SLAM works", status: "NOT YET VALIDATED" },
  AMCL: { id: "AMCL", name: "AMCL works", status: "NOT YET VALIDATED" },
  NAV: { id: "NAV", name: "Nav2 lifecycle active & planners wired", status: "NOT YET VALIDATED" },
  CAM: { id: "CAM", name: "Camera works", status: "NOT YET VALIDATED" },
  FILT: { id: "FILT", name: "Keepout/speed filters", status: "NOT YET VALIDATED" },
  CM: { id: "CM", name: "Collision monitor", status: "NOT YET VALIDATED" },
  BT: { id: "BT", name: "Behaviour tree view", status: "NOT YET VALIDATED" },
  DOCK: { id: "DOCK", name: "Docking server", status: "PENDING" },
  NS: { id: "NS", name: "Multi-robot namespaces", status: "PENDING" },
};

export function getRobotReadiness(robotId) {
  const r = (FIXTURE_STATUS.robots && FIXTURE_STATUS.robots[robotId]) || {};
  const out = {};
  for (const id of Object.keys(CHECKS)) out[id] = !!(r[id] && r[id].pass);
  return out;
}

export function isGameUnlocked(gameId, robotId, requiredChecks = []) {
  const readiness = getRobotReadiness(robotId);
  for (const check of requiredChecks) {
    if (!readiness[check]) {
      return { unlocked: false, missingCheck: check };
    }
  }
  return { unlocked: true, missingCheck: null };
}

export function calculateScore(baseScore, timeMs, penalties, config = {}) {
  const timePenalty = Math.floor((timeMs || 0) / 100);
  const actionPenalty = (penalties || 0) * (config.penaltyWeight || 50);
  return Math.max(0, baseScore - timePenalty - actionPenalty);
}

const memoryStore = new Map();

export function getLeaderboard(gameId) {
  try {
    const key = `ros2lab-lb-${gameId}`;
    if (typeof localStorage !== "undefined" && localStorage.getItem(key)) {
      return JSON.parse(localStorage.getItem(key));
    }
    return memoryStore.get(key) || [];
  } catch {
    return memoryStore.get(`ros2lab-lb-${gameId}`) || [];
  }
}

export function saveScore(gameId, entry) {
  try {
    const lb = getLeaderboard(gameId);
    lb.push(entry);
    lb.sort((a, b) => b.score - a.score);
    const top10 = lb.slice(0, 10);
    const key = `ros2lab-lb-${gameId}`;
    memoryStore.set(key, top10);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, JSON.stringify(top10));
    }
    return top10;
  } catch {
    const key = `ros2lab-lb-${gameId}`;
    const lb = memoryStore.get(key) || [];
    lb.push(entry);
    lb.sort((a, b) => b.score - a.score);
    memoryStore.set(key, lb);
    return lb;
  }
}
