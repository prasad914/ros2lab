// Readiness checks and robot mission game configuration (Prompt P12)
export const CHECKS = {
  TF: { id: "TF", name: "TF tree complete", status: "VERIFIED" },
  FIXED_FRAME: { id: "FIXED_FRAME", name: "Fixed Frame selectable", status: "VERIFIED" },
  SENS: { id: "SENS", name: "Required sensor topics", status: "VERIFIED" },
  SLAM: { id: "SLAM", name: "SLAM works", status: "VERIFIED" },
  AMCL: { id: "AMCL", name: "AMCL works", status: "VERIFIED" },
  NAV: { id: "NAV", name: "Nav2 lifecycle active & planners wired", status: "VERIFIED" },
  CAM: { id: "CAM", name: "Camera works", status: "VERIFIED" },
  FILT: { id: "FILT", name: "Keepout/speed filters", status: "VERIFIED" },
  CM: { id: "CM", name: "Collision monitor", status: "VERIFIED" },
  BT: { id: "BT", name: "Behaviour tree view", status: "VERIFIED" },
  DOCK: { id: "DOCK", name: "Docking server", status: "PENDING" },
  NS: { id: "NS", name: "Multi-robot namespaces", status: "PENDING" },
};

export function getRobotReadiness(robotId) {
  const isBurger = robotId === "tb3_burger";
  return {
    TF: true,
    FIXED_FRAME: true,
    SENS: true,
    SLAM: true,
    AMCL: true,
    NAV: true,
    CAM: !isBurger, // burger has no camera; waffle and waffle_pi have camera
    FILT: true,
    CM: true,
    BT: true,
    DOCK: false, // PENDING for TB3
    NS: false, // PENDING for single robot
  };
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
