import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Timer from "../components/Timer";
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";
import "../styles/Workout.css";
import ExerciseAnalyzer from "../SquatAnalyzer";

// ─── Exercises that use live pose detection ───────────────────────────────────
const POSE_EXERCISES = new Set([
  "squats", "pushup", "pushups", "planks", "plank", "burpees",
  "jumping_jacks", "running_in_place", "steps", "yoga", "pilates",
  "zumba", "resistance_band", "dumbbells",
]);

// ─── Human-readable titles ────────────────────────────────────────────────────
const EXERCISE_TITLES = {
  squats: "Squats",
  pushup: "Push-Ups",
  pushups: "Push-Ups",
  planks: "Planks",
  plank: "Planks",
  burpees: "Burpees",
  jumping_jacks: "Jumping Jacks",
  running_in_place: "Running in Place",
  steps: "Steps",
  yoga: "Yoga",
  pilates: "Pilates",
  zumba: "Zumba",
  resistance_band: "Resistance Band",
  dumbbells: "Dumbbells",
};

// ─── TTS helper ───────────────────────────────────────────────────────────────
const lastSpokenRef = { text: "", time: 0 };

function speakText(text, rate = 1) {
  if (!window.speechSynthesis) return;
  const now = Date.now();
  // Deduplicate: skip if same text spoken within 5 s
  if (lastSpokenRef.text === text && now - lastSpokenRef.time < 5000) return;
  lastSpokenRef.text = text;
  lastSpokenRef.time = now;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = rate;
  utter.lang = "en-US";
  window.speechSynthesis.speak(utter);
}

export default function Workout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = (searchParams.get("type") || "running_in_place").toLowerCase();

  const videoRef = useRef(null);

  /* ====== EXERCISE MAP (video-based dropdown exercises) ====== */
  const exerciseMap = {
    dumbbells: [
      { label: "360 Rotation", file: "360.mp4" },
      { label: "Dumbbell Lunges", file: "Dumbbell_Lunge.mp4" },
      { label: "Glutes", file: "glutes.mp4" },
      { label: "Massive Arm", file: "massive_arm.mp4" },
    ],
    pilates: [
      { label: "Bench Dips", file: "Bench_Dips.mp4" },
      { label: "Bulgarian Split", file: "Bulgarian_Split.mp4" },
      { label: "Goal Post", file: "Goal_post.mp4" },
      { label: "Oblique Exercise", file: "Oblique_exercise.mp4" },
      { label: "Crunches", file: "crunches.mp4" },
      { label: "Wall Workout", file: "wall_workout.mp4" },
    ],
    pushup: [
      { label: "Standard Push-Ups", file: "pushups.mp4" },
      { label: "Knee Push-Ups", file: "knee_pushups.mp4" },
    ],
    resistance_band: [
      { label: "Thighs", file: "Thighs.mp4" },
      { label: "Side", file: "side.mp4" },
      { label: "Upper Body", file: "upper.mp4" },
      { label: "Upper Body 2", file: "upper2.mp4" },
    ],
    zumba: [
      { label: "3 Min", file: "3min.mp4" },
      { label: "4 Min Tabata", file: "4min_Tabata.mp4" },
      { label: "Arm Slow Workout", file: "Arm_slow_workout.mp4" },
      { label: "Beginner", file: "Begineer.mp4" },
      { label: "Dura", file: "Dura.mp4" },
      { label: "Fat Burning", file: "Fat_burning.mp4" },
      { label: "Crazy", file: "crazy.mp4" },
    ],
  };

  /* ====== CORE STATE ====== */
  const [variationIndex, setVariationIndex] = useState(0);
  const [targetReps, setTargetReps] = useState(5);   // user-set goal
  const [speed, setSpeed] = useState(1);
  const [completedReps, setCompletedReps] = useState(0);
  const [goalDone, setGoalDone] = useState(false);
  const [isRunning, setIsRunning] = useState(false); // timer-driven
  const [showSaveUI, setShowSaveUI] = useState(false); // show save/login prompt
  const [sessionSaved, setSessionSaved] = useState(false); // saved confirmation

  const goalTriggeredRef = useRef(false); // one-time goal flag
  const sessionSavedRef = useRef(false); // legacy alias kept for video loop

  /* ====== MIC STATE ====== */
  const [micActive, setMicActive] = useState(false);
  const [userSpeech, setUserSpeech] = useState("");
  const [aiText, setAiText] = useState("Press Start on the timer to begin!");
  const [isListening, setIsListening] = useState(false);

  /* ====== DURATION ====== */
  const elapsedRef = useRef(0);

  /* ====== POSE REFS ====== */
  const lastFeedbackRef = useRef("");
  const poseRepCount = useRef(0);

  /* ====== YOUTUBE ====== */
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoId, setVideoId] = useState("");

  /* ====== SPEECH RECOGNITION REFS ====== */
  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);

  // Keep speed in a ref for use inside speech recognition closure
  const speedRef = useRef(speed);
  const isRunningRef = useRef(false);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);

  /* ====== EXERCISE LABEL ====== */
  const exerciseLabel = EXERCISE_TITLES[type] || type.replaceAll("_", " ");

  /* ====== TIMER CALLBACKS ====== */
  const handleTimerTick = useCallback((secs) => {
    elapsedRef.current = secs;
  }, []);

  // Called by Timer whenever it starts/pauses
  const handleIsRunning = useCallback((running) => {
    setIsRunning(running);
  }, []);

  /* ====== SESSION SAVE (manual, on button click) ====== */
  const saveSession = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const finalReps = poseRepCount.current || completedReps;
    try {
      const res = await fetch("http://localhost:8000/api/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          exercise: type,
          reps: finalReps,
          accuracy: 80,
          duration: elapsedRef.current,
        }),
      });
      if (res.ok) {
        setSessionSaved(true);
        setShowSaveUI(false);
        setAiText("✅ Session saved to your history!");
        speakText("Session saved!");
      }
    } catch (err) {
      console.warn("Session save failed:", err);
    }
  }, [type, completedReps]);

  /* ====== GOAL COMPLETE (fires exactly once) ====== */
  const triggerGoalComplete = useCallback(() => {
    if (goalTriggeredRef.current) return;
    goalTriggeredRef.current = true;
    sessionSavedRef.current = true; // keep video loop guard
    setGoalDone(true);
    setIsRunning(false);
    setShowSaveUI(true);
    setAiText("✅ Goal Completed! Amazing work!");
    speakText("Goal completed! Amazing work!");
  }, []);

  /* ====== POSE CALLBACKS ====== */
  const handleFeedbackUpdate = useCallback((msg) => {
    if (msg && msg !== lastFeedbackRef.current) {
      lastFeedbackRef.current = msg;
      setAiText(msg);
      speakText(msg);
    }
  }, []);

  const handleRepsUpdate = useCallback((count) => {
    poseRepCount.current = count;
    speakText(`Rep ${count} complete! Keep going!`);
    // Only trigger goal if: reps reached AND timer is running AND not already done
    if (count >= targetReps && isRunningRef.current && !goalTriggeredRef.current) {
      triggerGoalComplete();
    }
  }, [targetReps, triggerGoalComplete]);

  /* ====== VIDEO LOOP (non-pose exercises) ====== */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;

    const handleEnded = async () => {
      if (goalDone || !isRunning) return;
      const next = completedReps + 1;
      if (next < targetReps) {
        setCompletedReps(next);
        video.currentTime = 0;
        video.play();
        speakText(`Rep ${next} done! Keep going!`);
      } else if (!sessionSavedRef.current) {
        await triggerGoalComplete();
      }
    };

    video.addEventListener("ended", handleEnded);
    return () => video.removeEventListener("ended", handleEnded);
  }, [targetReps, speed, completedReps, goalDone, isRunning, triggerGoalComplete]);

  useEffect(() => {
    setCompletedReps(0);
    sessionSavedRef.current = false;
    goalTriggeredRef.current = false;
    setGoalDone(false);
    setShowSaveUI(false);
    setSessionSaved(false);
    poseRepCount.current = 0;
    if (videoRef.current) videoRef.current.currentTime = 0;
  }, [variationIndex]);

  /* ====== SPEECH RECOGNITION ====== */
  const stopRecognition = useCallback(() => {
    shouldListenRef.current = false;
    setMicActive(false);
    setIsListening(false);
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
  }, []);

  const startRecognition = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setAiText("Speech recognition not supported in this browser.");
      return;
    }
    if (recognitionRef.current) recognitionRef.current.abort();

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      setUserSpeech(transcript);
      const lower = transcript.toLowerCase();

      let reply = "";

      if (lower.includes("start")) {
        reply = "Starting workout";
      } else if (lower.includes("stop") || lower.includes("pause")) {
        reply = "Workout stopped";
      } else if (lower.includes("reset")) {
        reply = "Workout reset.";
        setCompletedReps(0);
        poseRepCount.current = 0;
        sessionSavedRef.current = false;
        goalTriggeredRef.current = false;
        setGoalDone(false);
        setShowSaveUI(false);
        setSessionSaved(false);
      } else if (lower.includes("faster")) {
        const newSpeed = Math.min(speedRef.current + 0.5, 2);
        setSpeed(newSpeed);
        reply = "Increase speed";
      } else if (lower.includes("slower")) {
        const newSpeed = Math.max(speedRef.current - 0.5, 0.5);
        setSpeed(newSpeed);
        reply = `Speed reduced to ${newSpeed}x.`;
      } else if (lower.includes("good") || lower.includes("great") || lower.includes("nice") || lower.includes("awesome")) {
        reply = "Keep going";
      } else if (lower.includes("tired") || lower.includes("rest") || lower.includes("break")) {
        reply = "Take a short rest, then get back at it!";
      } else if (lower.includes("how many") || lower.includes("count") || lower.includes("reps")) {
        const count = poseRepCount.current || completedReps;
        reply = `You've done ${count} of ${targetReps} reps. Keep going!`;
      } else if (lower.includes("help")) {
        reply = "Say: start, stop, faster, slower, tired, how many.";
      } else {
        reply = `Stay focused. You're doing ${exerciseLabel}. Keep it up!`;
      }

      setAiText(reply);
      speakText(reply);
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setAiText("Microphone access denied. Please allow mic in browser settings.");
        stopRecognition();
      }
      // ignore no-speech / audio-capture silently
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart loop while mic is active
      if (shouldListenRef.current) {
        setTimeout(() => {
          if (shouldListenRef.current) startRecognition();
        }, 300);
      }
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch (e) { console.warn("Recognition start error:", e); }
  }, [stopRecognition, targetReps, completedReps, exerciseLabel]);

  const toggleMic = useCallback(() => {
    if (micActive) {
      stopRecognition();
      setUserSpeech("");
      setAiText("Mic off.");
    } else {
      setMicActive(true);
      shouldListenRef.current = true;
      startRecognition();
    }
  }, [micActive, startRecognition, stopRecognition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecognition();
      window.speechSynthesis?.cancel();
    };
  }, [stopRecognition]);

  /* ====== YOUTUBE IMPORT ====== */
  const extractVideoId = (url) => {
    const regExp = /(?:youtube\.com\/(?:.*v=|embed\/|v\/)|youtu\.be\/)([^#&?]*)/;
    const match = url.match(regExp);
    return match && match[1].length === 11 ? match[1] : null;
  };

  /* ====== IMPORT VIEW ====== */
  if (type === "import") {
    return (
      <div className="workout-wrapper">
        <div className="workout-header">
          <button className="back-btn" onClick={() => navigate("/menu")}>
            ← Back
          </button>
          <span className="header-title">Import From YouTube</span>
        </div>

        {!videoId ? (
          <div className="setup-card">
            <h2>Import Exercise From YouTube</h2>
            <input
              type="text"
              placeholder="Paste YouTube URL"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className="youtube-input"
            />
            <button
              className="primary-btn"
              onClick={() => {
                const id = extractVideoId(youtubeUrl);
                if (id) setVideoId(id);
                else alert("Invalid YouTube URL");
              }}
            >
              Load Video
            </button>
          </div>
        ) : (
          <div className="workout-grid">
            <div className="camera-section">
              <ExerciseAnalyzer exerciseType="squats" isRunning={isRunning} />
            </div>
            <div className="video-section">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube player"
                allowFullScreen
                className="exercise-video"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ====== VIDEO SOURCE ====== */
  const videoSrc = exerciseMap[type]
    ? `/videos/${type}/${exerciseMap[type][variationIndex].file}`
    : `/videos/${type}.mp4`;

  return (
    <div className="workout-wrapper">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="workout-header">
        <button className="back-btn" onClick={() => navigate("/menu")}>
          ← Back
        </button>
        <span className="header-title">
          {exerciseLabel.toUpperCase()} SESSION
        </span>
      </div>

      {/* ── Goal Complete Banner ─────────────────────── */}
      {goalDone && (
        <div className="goal-complete-banner">
          ✅ Goal Completed! Great work on your {exerciseLabel} session!
          {showSaveUI && !sessionSaved && (
            <div className="save-prompt">
              {localStorage.getItem("token") ? (
                <button className="save-session-btn" onClick={saveSession}>
                  💾 Save to History
                </button>
              ) : (
                <button
                  className="save-session-btn save-login"
                  onClick={() => navigate("/", { state: { openLogin: true, from: "/workout" } })}
                >
                  🔐 Login to save this workout
                </button>
              )}
            </div>
          )}
          {sessionSaved && (
            <div className="save-confirmed">✅ Saved to history!</div>
          )}
        </div>
      )}

      {/* ── Main Grid ───────────────────────────────── */}
      <div className="workout-grid">

        <div className="camera-section">
          <ExerciseAnalyzer
            exerciseType={type}
            isRunning={isRunning}
            onRepsUpdate={handleRepsUpdate}
            onFeedbackUpdate={handleFeedbackUpdate}
          />
        </div>

        <div className="video-section">
          <video
            ref={videoRef}
            src={videoSrc}
            controls
            className="exercise-video"
          />
        </div>

      </div>

      {/* ── Controls ────────────────────────────────── */}
      <div className="controls-panel">

        <div className="controls-left">

          {exerciseMap[type] && (
            <label>
              Variation
              <select
                value={variationIndex}
                onChange={(e) => setVariationIndex(Number(e.target.value))}
              >
                {exerciseMap[type].map((item, idx) => (
                  <option key={idx} value={idx}>{item.label}</option>
                ))}
              </select>
            </label>
          )}

          <label>
            Goal Reps
            <input
              type="number"
              min="1"
              value={targetReps}
              onChange={(e) => {
                setCompletedReps(0);
                poseRepCount.current = 0;
                sessionSavedRef.current = false;
                setGoalDone(false);
                setTargetReps(Number(e.target.value));
              }}
            />
          </label>

          <label>
            Speed
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
              <option value="0.5">0.5x</option>
              <option value="1">1x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>
          </label>

          {/* Video-exercise rep counter */}
          {!POSE_EXERCISES.has(type) && (
            <div className="rep-progress">
              Reps: <strong>{completedReps}</strong> / {targetReps}
            </div>
          )}

        </div>

        <div className="controls-center">
          <Timer onTick={handleTimerTick} onIsRunning={handleIsRunning} />
        </div>

        <div className="controls-right">

          <button
            id="mic-toggle-btn"
            className={`mic-btn ${micActive ? "active" : ""}`}
            onClick={toggleMic}
            title={micActive ? "Stop Listening" : "Start Voice Coach"}
          >
            {micActive ? <FaMicrophone /> : <FaMicrophoneSlash />}
          </button>

          <div className="caption-box">
            {isListening && (
              <div className="listening-indicator">🎙 Listening...</div>
            )}
            {userSpeech && (
              <div className="speech-user">You: {userSpeech}</div>
            )}
            <div className="speech-ai">{aiText}</div>
          </div>

        </div>

      </div>

    </div>
  );
}