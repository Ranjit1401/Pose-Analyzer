import { useEffect, useRef, useState } from "react";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

// ─── ANGLE UTIL ───────────────────────────────────────────────────────────────
function calcAngle(a, b, c) {
  const rad =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((rad * 180.0) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ─── PER-EXERCISE ANALYZERS ───────────────────────────────────────────────────

function analyzeSquat(lm, state) {
  const lHip = lm[23], lKnee = lm[25], lAnkle = lm[27];
  const rHip = lm[24], rKnee = lm[26], rAnkle = lm[28];
  const shoulder = lm[11];

  const leftKnee  = calcAngle(lHip, lKnee, lAnkle);
  const rightKnee = calcAngle(rHip, rKnee, rAnkle);
  const backAng   = calcAngle(shoulder, lHip, lAnkle);
  const avg       = (leftKnee + rightKnee) / 2;

  let feedback = "Perfect Form ✅";
  let isCorrect = true;
  let formScore = 100;
  let countRep = false;

  if (backAng < 150) { feedback = "Keep Back Straight ⚠️"; isCorrect = false; formScore -= 25; }
  if (avg < 90)      { feedback = "Great Depth! 🔥"; }
  else if (avg < 130) { feedback = "Go Lower ⬇️"; isCorrect = false; formScore -= 20; }
  if (Math.abs(leftKnee - rightKnee) > 15) { feedback = "Leg Imbalance ⚠️"; isCorrect = false; formScore -= 15; }

  if (avg > 160 && state.current === "DOWN") {
    state.current = "STANDING"; countRep = true;
  } else if (avg < 100 && state.current === "STANDING") {
    state.current = "DOWN";
  } else if (avg > 160) {
    state.current = "STANDING";
  }

  return {
    feedback, isCorrect, formScore: Math.max(0, formScore), countRep,
    stage: state.current,
    angles: { "Left Knee": Math.round(leftKnee), "Right Knee": Math.round(rightKnee), "Back": Math.round(backAng) },
    highlightJoints: [lKnee, rKnee],
  };
}

function analyzePushup(lm, state) {
  const lShoulder = lm[11], lElbow = lm[13], lWrist = lm[15];
  const rShoulder = lm[12], rElbow = lm[14], rWrist = lm[16];
  const lHip = lm[23], lAnkle = lm[27];

  const leftElbow  = calcAngle(lShoulder, lElbow, lWrist);
  const rightElbow = calcAngle(rShoulder, rElbow, rWrist);
  const bodyLine   = calcAngle(lShoulder, lHip, lAnkle);
  const avg        = (leftElbow + rightElbow) / 2;

  let feedback = "Perfect Form ✅";
  let isCorrect = true;
  let formScore = 100;
  let countRep = false;

  if (bodyLine < 155) { feedback = "Keep Body Straight ⚠️"; isCorrect = false; formScore -= 20; }
  if (avg < 90)       { feedback = "Great Depth! 🔥"; }
  else if (avg < 130) { feedback = "Go Lower ⬇️"; isCorrect = false; formScore -= 20; }

  if (avg > 160 && state.current === "DOWN") {
    state.current = "UP"; countRep = true;
  } else if (avg < 90 && state.current !== "DOWN") {
    state.current = "DOWN";
  } else if (avg > 160 && state.current !== "DOWN") {
    state.current = "UP";
  }

  return {
    feedback, isCorrect, formScore: Math.max(0, formScore), countRep,
    stage: state.current,
    angles: { "Left Elbow": Math.round(leftElbow), "Right Elbow": Math.round(rightElbow), "Body": Math.round(bodyLine) },
    highlightJoints: [lElbow, rElbow],
  };
}

function analyzePlank(lm, state) {
  const lShoulder = lm[11], lHip = lm[23], lAnkle = lm[27];
  const bodyLine = calcAngle(lShoulder, lHip, lAnkle);

  let feedback = "Hold It! Great Plank 💪";
  let isCorrect = true;
  let formScore = 100;

  if (bodyLine < 150) { feedback = "Raise Your Hips ⬆️"; isCorrect = false; formScore -= 30; }
  else if (bodyLine > 185) { feedback = "Lower Your Hips ⬇️"; isCorrect = false; formScore -= 20; }

  state.current = "PLANK";
  return {
    feedback, isCorrect, formScore: Math.max(0, formScore), countRep: false,
    stage: "PLANK",
    angles: { "Body Alignment": Math.round(bodyLine) },
    highlightJoints: [lHip],
  };
}

function analyzeBurpee(lm, state) {
  const lHip = lm[23], lKnee = lm[25], lAnkle = lm[27];
  const rHip = lm[24], rKnee = lm[26], rAnkle = lm[28];
  const lShoulder = lm[11];

  const avgKnee   = (calcAngle(lHip, lKnee, lAnkle) + calcAngle(rHip, rKnee, rAnkle)) / 2;
  const hipHeight = (lHip.y + rHip.y) / 2;

  let feedback = "Follow the Range 🔁";
  let isCorrect = true;
  let formScore = 100;
  let countRep = false;

  if (avgKnee > 155 && hipHeight < 0.6) {
    if (state.current === "DOWN") { state.current = "STANDING"; countRep = true; feedback = "Rep Done! 🎉"; }
    else { state.current = "STANDING"; feedback = "Standing – Go Down! ⬇️"; }
  } else if (avgKnee < 100 || hipHeight > 0.7) {
    if (state.current === "STANDING") state.current = "DOWN";
    feedback = avgKnee < 100 ? "Good Squat Depth! 🔥" : "Plank Position! 💪";
  }

  return {
    feedback, isCorrect, formScore: Math.max(0, formScore), countRep,
    stage: state.current,
    angles: { "Avg Knee": Math.round(avgKnee), "Hip Height": Math.round(hipHeight * 100) + "%" },
    highlightJoints: [lKnee, lHip],
  };
}

// Jumping Jacks: arms up + legs spread
function analyzeJumpingJack(lm, state) {
  const lShoulder = lm[11], rShoulder = lm[12];
  const lElbow    = lm[13], rElbow    = lm[14];
  const lWrist    = lm[15], rWrist    = lm[16];
  const lHip      = lm[23], rHip      = lm[24];
  const lAnkle    = lm[27], rAnkle    = lm[28];

  // Arms: angle at shoulder (torso→shoulder→wrist). Arms UP = large angle
  const leftArm  = calcAngle(lHip, lShoulder, lWrist);
  const rightArm = calcAngle(rHip, rShoulder, rWrist);
  const avgArm   = (leftArm + rightArm) / 2;

  // Legs spread: distance between ankles relative to hip width
  const hipWidth    = dist(lHip, rHip);
  const ankleWidth  = dist(lAnkle, rAnkle);
  const legSpread   = hipWidth > 0 ? ankleWidth / hipWidth : 1;

  // Arms UP when avgArm > 140°, legs SPREAD when legSpread > 1.8
  const armsUp    = avgArm > 130;
  const legsSpread = legSpread > 1.6;

  let feedback = "Jump! Arms Up + Legs Wide 🎉";
  let isCorrect = true;
  let formScore = 100;
  let countRep = false;

  if (!armsUp)    { feedback = "Raise Both Arms Higher ⬆️"; isCorrect = false; formScore -= 30; }
  if (!legsSpread) { feedback = "Spread Legs Wider ↔️"; isCorrect = false; formScore -= 25; }
  if (armsUp && legsSpread) { feedback = "Perfect Jack! 🌟"; }

  // State: CLOSED → OPEN → CLOSED = 1 rep
  const isOpen = armsUp && legsSpread;
  if (isOpen && state.current === "CLOSED") {
    state.current = "OPEN";
  } else if (!isOpen && state.current === "OPEN") {
    state.current = "CLOSED";
    countRep = true;
  } else if (!state.current || state.current === "STANDING") {
    state.current = "CLOSED";
  }

  return {
    feedback, isCorrect, formScore: Math.max(0, formScore), countRep,
    stage: state.current,
    angles: { "Arms": Math.round(avgArm) + "°", "Leg Spread": legSpread.toFixed(2) + "x" },
    highlightJoints: [lWrist, rWrist],
  };
}

// Running in place: knee lift alternation
function analyzeRunning(lm, state) {
  const lHip   = lm[23], lKnee  = lm[25], lAnkle = lm[27];
  const rHip   = lm[24], rKnee  = lm[26], rAnkle = lm[28];

  // Knee lift = knee Y lower than hip Y (in screen coords, lower y = higher position)
  const lKneeLift = lHip.y - lKnee.y; // positive means knee above hip
  const rKneeLift = rHip.y - rKnee.y;

  const lLifted = lKneeLift > 0.05;
  const rLifted = rKneeLift > 0.05;

  let feedback = "Keep Running! Lift Those Knees 🏃";
  let formScore = 100;
  let isCorrect = true;
  let countRep  = false;

  if (!lLifted && !rLifted) { feedback = "Lift Knees Higher! ⬆️"; isCorrect = false; formScore -= 30; }
  else if (lLifted)         { feedback = "Left Knee Up! 🦵"; }
  else if (rLifted)         { feedback = "Right Knee Up! 🦵"; }

  // Count: left step → right step = 1 rep (simplified: any lift transition)
  const lifted = lLifted ? "LEFT" : rLifted ? "RIGHT" : "NONE";
  if (!state.current) state.current = "NONE";

  if (lifted !== "NONE" && lifted !== state.current) {
    state.current = lifted;
    // count every 2 steps as 1 rep
    if (!state.steps) state.steps = 0;
    state.steps++;
    if (state.steps % 2 === 0) countRep = true;
  }

  return {
    feedback, isCorrect, formScore: Math.max(0, formScore), countRep,
    stage: lLifted ? "LEFT" : rLifted ? "RIGHT" : "Running",
    angles: { "L Lift": lKneeLift.toFixed(2), "R Lift": rKneeLift.toFixed(2) },
    highlightJoints: [lKnee, rKnee],
  };
}

// Steps: detect stepping motion (alternating knee rise)
function analyzeSteps(lm, state) {
  const lHip = lm[23], lKnee = lm[25];
  const rHip = lm[24], rKnee = lm[26];

  const lLift = lHip.y - lKnee.y;
  const rLift = rHip.y - rKnee.y;

  const lUp = lLift > 0.08;
  const rUp = rLift > 0.08;

  let feedback = "Step Up! Alternate Legs 🦶";
  let formScore = 100;
  let isCorrect = true;
  let countRep  = false;

  if (!lUp && !rUp) { feedback = "Lift Your Knee Higher ⬆️"; isCorrect = false; formScore -= 25; }

  if (!state.current) state.current = "NONE";
  const current = lUp ? "LEFT" : rUp ? "RIGHT" : "NONE";
  if (current !== "NONE" && current !== state.current) {
    state.current = current;
    if (!state.steps) state.steps = 0;
    state.steps++;
    if (state.steps % 2 === 0) countRep = true;
    feedback = `${current} step! 💪`;
  }

  return {
    feedback, isCorrect, formScore, countRep,
    stage: state.current || "STEP",
    angles: { "L Rise": lLift.toFixed(2), "R Rise": rLift.toFixed(2) },
    highlightJoints: [lKnee, rKnee],
  };
}

// Yoga: body balance/alignment (tree pose / warrior-like)
function analyzeYoga(lm, state) {
  const lShoulder = lm[11], rShoulder = lm[12];
  const lHip      = lm[23], rHip      = lm[24];
  const lAnkle    = lm[27], rAnkle    = lm[28];

  const bodyLine  = calcAngle(lShoulder, lHip, lAnkle);
  const shoulders = Math.abs(lShoulder.y - rShoulder.y);
  const hips      = Math.abs(lHip.y - rHip.y);

  let feedback = "Great Balance! 🧘";
  let formScore = 100;
  let isCorrect = true;

  if (bodyLine < 155) { feedback = "Straighten Your Spine ⬆️"; isCorrect = false; formScore -= 25; }
  if (shoulders > 0.05) { feedback = "Level Your Shoulders ↔️"; isCorrect = false; formScore -= 20; }
  if (hips > 0.05) { feedback = "Keep Hips Level ↔️"; isCorrect = false; formScore -= 15; }

  state.current = "HOLD";
  return {
    feedback, isCorrect, formScore: Math.max(0, formScore), countRep: false,
    stage: "HOLD",
    angles: { "Body Line": Math.round(bodyLine) + "°", "Shoulder Diff": (shoulders * 100).toFixed(1) },
    highlightJoints: [lHip, rHip],
  };
}

// Pilates: core engagement (hip hinge / crunch detection)
function analyzePilates(lm, state) {
  const lShoulder = lm[11], lHip = lm[23], lKnee = lm[25];
  const rShoulder = lm[12], rHip = lm[24];

  const leftSide  = calcAngle(lShoulder, lHip, lKnee);
  const rightSide = calcAngle(rShoulder, rHip, lKnee);
  const avg       = (leftSide + rightSide) / 2;

  let feedback = "Core Engaged! 💪";
  let formScore = 100;
  let isCorrect = true;
  let countRep  = false;

  if (avg > 160) { feedback = "Crunch In – Contract Core ⬇️"; isCorrect = false; formScore -= 20; }
  else if (avg < 90) { feedback = "Great Depth! 🔥"; }

  if (avg < 110 && state.current !== "DOWN") {
    state.current = "DOWN";
  } else if (avg > 155 && state.current === "DOWN") {
    state.current = "UP";
    countRep = true;
  }

  return {
    feedback, isCorrect, formScore: Math.max(0, formScore), countRep,
    stage: state.current || "UP",
    angles: { "Hip Angle": Math.round(avg) + "°" },
    highlightJoints: [lHip, rHip],
  };
}

// Zumba: full body movement energy – detect any rhythmic motion
function analyzeZumba(lm, state) {
  const lWrist = lm[15], rWrist = lm[16];
  const lAnkle = lm[27], rAnkle = lm[28];
  const lHip   = lm[23], rHip   = lm[24];

  if (!state.prevWrists) {
    state.prevWrists = { lx: lWrist.x, rx: rWrist.x };
    state.prevAnkles = { lx: lAnkle.x, rx: rAnkle.x };
    state.energy = 0;
    state.current = "DANCE";
  }

  const wristMove  = Math.abs(lWrist.x - state.prevWrists.lx) + Math.abs(rWrist.x - state.prevWrists.rx);
  const ankleMove  = Math.abs(lAnkle.x - state.prevAnkles.lx) + Math.abs(rAnkle.x - state.prevAnkles.rx);
  const totalMove  = wristMove + ankleMove;

  state.prevWrists = { lx: lWrist.x, rx: rWrist.x };
  state.prevAnkles = { lx: lAnkle.x, rx: rAnkle.x };
  state.energy     = totalMove;

  let feedback = "Keep Dancing! 💃";
  let formScore = 100;
  let isCorrect = true;
  let countRep  = false;

  if (totalMove < 0.005) {
    feedback = "Move More! Feel the Beat 🎵"; isCorrect = false; formScore -= 40;
  } else if (totalMove > 0.02) {
    feedback = "Amazing Energy! 🔥";
    if (!state.beat) state.beat = 0;
    state.beat++;
    if (state.beat % 8 === 0) countRep = true;
  }

  return {
    feedback, isCorrect, formScore: Math.max(0, formScore), countRep,
    stage: "DANCE",
    angles: { "Energy": (totalMove * 1000).toFixed(1) },
    highlightJoints: [lWrist, rWrist],
  };
}

// Resistance Band: upper body pull detection
function analyzeResistanceBand(lm, state) {
  const lShoulder = lm[11], lElbow = lm[13], lWrist = lm[15];
  const rShoulder = lm[12], rElbow = lm[14], rWrist = lm[16];

  const leftArm  = calcAngle(lShoulder, lElbow, lWrist);
  const rightArm = calcAngle(rShoulder, rElbow, rWrist);
  const avg      = (leftArm + rightArm) / 2;

  let feedback = "Pull the Band! 💪";
  let formScore = 100;
  let isCorrect = true;
  let countRep  = false;

  if (avg < 80)       { feedback = "Full Contraction! 🔥"; }
  else if (avg < 120) { feedback = "Pull More ⬅️"; isCorrect = false; formScore -= 15; }
  else                { feedback = "Start the Pull ➡️"; }

  if (avg < 90 && state.current !== "PULLED") {
    state.current = "PULLED";
  } else if (avg > 150 && state.current === "PULLED") {
    state.current = "REST";
    countRep = true;
  }

  return {
    feedback, isCorrect, formScore: Math.max(0, formScore), countRep,
    stage: state.current || "REST",
    angles: { "L Arm": Math.round(leftArm) + "°", "R Arm": Math.round(rightArm) + "°" },
    highlightJoints: [lElbow, rElbow],
  };
}

// Dumbbells: curl detection (elbow flexion)
function analyzeDumbbells(lm, state) {
  const lShoulder = lm[11], lElbow = lm[13], lWrist = lm[15];
  const rShoulder = lm[12], rElbow = lm[14], rWrist = lm[16];

  const leftCurl  = calcAngle(lShoulder, lElbow, lWrist);
  const rightCurl = calcAngle(rShoulder, rElbow, rWrist);
  const avg       = (leftCurl + rightCurl) / 2;

  let feedback = "Curl Up! 💪";
  let formScore = 100;
  let isCorrect = true;
  let countRep  = false;

  if (avg < 60)  { feedback = "Peak Contraction! 🔥"; }
  else if (avg < 100) { feedback = "Squeeze at the Top 💪"; }
  else { feedback = "Lower the Weight ⬇️"; }

  if (avg < 70 && state.current !== "UP") {
    state.current = "UP";
  } else if (avg > 150 && state.current === "UP") {
    state.current = "DOWN";
    countRep = true;
  }

  return {
    feedback, isCorrect, formScore: Math.max(0, formScore), countRep,
    stage: state.current || "DOWN",
    angles: { "L Curl": Math.round(leftCurl) + "°", "R Curl": Math.round(rightCurl) + "°" },
    highlightJoints: [lElbow, rElbow],
  };
}

// ─── EXERCISE ANALYZER MAP ────────────────────────────────────────────────────
const ANALYZERS = {
  squats:          analyzeSquat,
  pushup:          analyzePushup,
  pushups:         analyzePushup,
  planks:          analyzePlank,
  plank:           analyzePlank,
  burpees:         analyzeBurpee,
  jumping_jacks:   analyzeJumpingJack,
  running_in_place: analyzeRunning,
  steps:           analyzeSteps,
  yoga:            analyzeYoga,
  pilates:         analyzePilates,
  zumba:           analyzeZumba,
  resistance_band: analyzeResistanceBand,
  dumbbells:       analyzeDumbbells,
};

// ─── EXERCISE DISPLAY LABELS ─────────────────────────────────────────────────
const EXERCISE_LABELS = {
  squats:           "🏋 Squat Analyzer",
  pushup:           "💪 Push-Up Analyzer",
  pushups:          "💪 Push-Up Analyzer",
  planks:           "🧘 Plank Analyzer",
  plank:            "🧘 Plank Analyzer",
  burpees:          "🔥 Burpee Analyzer",
  jumping_jacks:    "⭐ Jumping Jacks",
  running_in_place: "🏃 Running in Place",
  steps:            "🦶 Steps Tracker",
  yoga:             "🧘 Yoga Pose Check",
  pilates:          "💫 Pilates Core",
  zumba:            "💃 Zumba Energy",
  resistance_band:  "🎽 Resistance Band",
  dumbbells:        "🏋 Dumbbell Curls",
};

// ─── COMPONENT ────────────────────────────────────────────────────────────────
function ExerciseAnalyzer({ exerciseType = "squats", onRepsUpdate, onFeedbackUpdate, isRunning = false }) {
  const videoRef       = useRef(null);
  const canvasRef      = useRef(null);
  const exerciseState  = useRef({ current: "STANDING" });
  const lastTime       = useRef(performance.now());
  const wrapperRef     = useRef(null);
  const isRunningRef   = useRef(isRunning);

  const [reps, setReps]         = useState(0);
  const [feedback, setFeedback] = useState("Initializing...");
  const [stage, setStage]       = useState("");
  const [score, setScore]       = useState(100);
  const [fps, setFps]           = useState(0);
  const [angles, setAngles]     = useState({});
  const [fullscreen, setFullscreen] = useState(false);

  const normalizedType = exerciseType?.toLowerCase() || "squats";
  const analyzer = ANALYZERS[normalizedType] || analyzeSquat;
  const label    = EXERCISE_LABELS[normalizedType] || "🏋 Exercise Analyzer";

  // Keep isRunningRef in sync with prop (avoids stale closure in camera loop)
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  // Reset state when exercise changes
  useEffect(() => {
    exerciseState.current = { current: "STANDING" };
    setReps(0);
    setFeedback("Initializing...");
    setStage("");
  }, [normalizedType]);

  useEffect(() => {
    const pose = new Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    pose.onResults((results) => {
      // Skip processing when workout is not running
      if (!isRunningRef.current) {
        // Still draw camera feed even when paused
        const canvas = canvasRef.current;
        if (canvas && results.image) {
          const ctx = canvas.getContext("2d");
          const w = videoRef.current?.videoWidth  || 640;
          const h = videoRef.current?.videoHeight || 480;
          canvas.width = w; canvas.height = h;
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(results.image, 0, 0, w, h);
        }
        return;
      }

      const now = performance.now();
      setFps(Math.round(1000 / (now - lastTime.current)));
      lastTime.current = now;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      const width  = videoRef.current?.videoWidth  || 640;
      const height = videoRef.current?.videoHeight || 480;
      canvas.width  = width;
      canvas.height = height;

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(results.image, 0, 0, width, height);

      if (!results.poseLandmarks) return;
      const lm = results.poseLandmarks;

      const result = analyzer(lm, exerciseState.current);

      if (result.countRep) {
        setReps((prev) => {
          const next = prev + 1;
          if (onRepsUpdate) onRepsUpdate(next);
          return next;
        });
      }

      setFeedback(result.feedback);
      setStage(result.stage || "");
      setScore(result.formScore);
      setAngles(result.angles || {});

      if (onFeedbackUpdate) onFeedbackUpdate(result.feedback);

      drawConnectors(ctx, lm, POSE_CONNECTIONS, {
        color: result.isCorrect ? "#00ff88" : "#ff3c3c",
        lineWidth: 4,
      });

      drawLandmarks(ctx, lm, {
        color: "#ffffff",
        lineWidth: 1,
        radius: 4,
      });

      ctx.font = "bold 16px Arial";
      ctx.fillStyle = "yellow";
      (result.highlightJoints || []).forEach((joint, i) => {
        const entries = Object.entries(result.angles || {});
        if (entries[i]) {
          ctx.fillText(
            `${entries[i][1]}`,
            joint.x * width + 8,
            joint.y * height - 8
          );
        }
      });
    });

    if (!videoRef.current) return;

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        await pose.send({ image: videoRef.current });
      },
      width: 640,
      height: 480,
    });

    camera.start();

    return () => {
      camera.stop?.();
      pose.close?.();
    };
  }, [normalizedType]);

  const toggleFullscreen = () => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    if (!document.fullscreenElement) {
      wrapper.requestFullscreen().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={`ai-camera-wrapper${fullscreen ? " ai-camera-fullscreen" : ""}`}
    >
      <video ref={videoRef} style={{ display: "none" }} />
      <canvas ref={canvasRef} className="ai-camera-video" />

      {/* Paused overlay — shown before workout starts */}
      {!isRunning && (
        <div className="paused-overlay">
          <span>📷 Camera Ready</span>
          <span style={{ fontSize: "15px", opacity: 0.75 }}>
            Press <strong>Start</strong> on the timer to begin
          </span>
        </div>
      )}

      {/* Fullscreen Toggle */}
      <button
        className="fullscreen-btn"
        onClick={toggleFullscreen}
        title={fullscreen ? "Exit Fullscreen" : "Fullscreen"}
      >
        {fullscreen ? "✕ Exit Fullscreen" : "⛶ Fullscreen"}
      </button>

      <div className="ai-overlay">
        <h3>{label}</h3>
        <p>Reps: <strong>{reps}</strong></p>
        {stage && <p>Stage: {stage}</p>}
        {Object.entries(angles).map(([k, v]) => (
          <p key={k}>{k}: {v}</p>
        ))}
        <p>Form: <strong>{score}%</strong></p>
        <p style={{ fontSize: "10px", opacity: 0.6 }}>FPS: {fps}</p>
        <div className={score > 70 ? "feedback-good" : "feedback-bad"}>
          {feedback}
        </div>
      </div>
    </div>
  );
}

export default ExerciseAnalyzer;