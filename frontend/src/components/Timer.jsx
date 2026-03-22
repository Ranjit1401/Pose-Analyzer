import { useState, useEffect, useRef, useCallback } from "react";
import "../styles/Workout.css";

// ─── STOPWATCH: counts UP from 0 ─────────────────────────────────────────────
// Props:
//   onTick(seconds)    — called every second with elapsed time
//   onIsRunning(bool)  — called whenever the running state changes
export default function Timer({ onTick, onIsRunning }) {
  const [seconds, setSeconds]   = useState(0);
  const [isActive, setIsActive] = useState(false);
  const intervalRef             = useRef(null);

  // Notify parent whenever running state changes
  useEffect(() => {
    if (onIsRunning) onIsRunning(isActive);
  }, [isActive, onIsRunning]);

  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        setSeconds((prev) => {
          const next = prev + 1;
          if (onTick) onTick(next);
          return next;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isActive]);

  const formatTime = (s) => {
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const handleStart = useCallback(() => {
    setIsActive(true);
  }, []);

  const handlePause = useCallback(() => {
    setIsActive(false);
  }, []);

  const handleReset = useCallback(() => {
    setIsActive(false);
    setSeconds(0);
    if (onTick) onTick(0);
  }, [onTick]);

  return (
    <div className="timer-container">
      <h2 className="timer-display">⏱ {formatTime(seconds)}</h2>

      <div className="timer-buttons">
        <button
          className="timer-btn"
          onClick={handleStart}
          disabled={isActive}
        >
          Start
        </button>

        <button
          className="timer-btn"
          onClick={handlePause}
          disabled={!isActive}
        >
          Pause
        </button>

        <button className="timer-btn" onClick={handleReset}>
          Reset
        </button>
      </div>
    </div>
  );
}
