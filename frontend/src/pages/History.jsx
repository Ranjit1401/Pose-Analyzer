import { useEffect, useState, useMemo } from "react";
import "../styles/History.css";
import ProgressHeatmap from "../components/ProgressHeatmap";

export default function History() {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    fetch("http://localhost:8000/api/sessions", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setWorkouts(data);
        else setWorkouts([]);
      })
      .catch(() => setWorkouts([]))
      .finally(() => setLoading(false));
  }, []);

  // Aggregate sessions by date (YYYY-MM-DD) for heatmap
  const heatmapData = useMemo(() => {
    const map = {};
    workouts.forEach((w) => {
      const day = w.date ? w.date.split(" ")[0] : null;
      if (!day) return;
      map[day] = (map[day] || 0) + 1;
    });
    return Object.entries(map).map(([date, count]) => ({ date, count }));
  }, [workouts]);

  const getAccuracyClass = (accuracy) => {
    if (accuracy >= 95) return "high";
    if (accuracy >= 85) return "medium";
    return "low";
  };

  return (
    <div className="history-wrapper">
      <h1 className="history-title">Workout History</h1>

      {!loading && workouts.length > 0 && (
        <ProgressHeatmap data={heatmapData} />
      )}

      {loading ? (
        <div className="empty-state">Loading...</div>
      ) : workouts.length === 0 ? (
        <div className="empty-state">
          No workouts recorded yet. Complete a workout to see history here!
        </div>
      ) : (
        <div className="history-table">
          <div className="history-header">
            <span>Exercise</span>
            <span>Date</span>
            <span>Accuracy</span>
            <span>Reps</span>
            <span>Duration</span>
          </div>

          {workouts.map((workout) => (
            <div key={workout.id} className="history-row">
              <span style={{ textTransform: "capitalize" }}>
                {workout.exercise.replaceAll("_", " ")}
              </span>
              <span>{workout.date}</span>

              <span className={`accuracy ${getAccuracyClass(workout.accuracy)}`}>
                {workout.accuracy}%
              </span>

              <span>{workout.reps}</span>
              <span>{workout.duration}s</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
