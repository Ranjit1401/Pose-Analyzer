import { useEffect, useState, useMemo } from "react";
import "../styles/History.css";

export default function History() {

  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterExercise, setFilterExercise] = useState("all");

  useEffect(() => {

    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return;
    }

    fetch('https://postureai-backend.onrender.com/api/sessions', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {

        if (Array.isArray(data)) {

          const sorted = data.sort(
            (a, b) => new Date(b.date) - new Date(a.date)
          );

          setWorkouts(sorted);

        } else {
          setWorkouts([]);
        }

      })
      .catch(() => setWorkouts([]))
      .finally(() => setLoading(false));

  }, []);

  const getAccuracyClass = (accuracy) => {

    if (accuracy >= 95) return "high";
    if (accuracy >= 85) return "medium";
    return "low";

  };

  const calculateCalories = (exercise, reps, duration) => {

    const calorieMap = {
      burpees: 0.5,
      dumbbells: 0.35,
      jumping_jacks: 0.2,
      planks: 0.15,
      pilates: 0.18,
      pushups: 0.32,
      resistance_band: 0.25,
      squat: 0.32,
      steps: 0.04,
      yoga: 0.12,
      zumba: 0.3
    };

    const name = exercise.toLowerCase();

    const perRep = calorieMap[name] || 0.2;

    if (
      name === "planks" ||
      name === "yoga" ||
      name === "pilates"
    ) {
      return Math.round(duration * 0.08);
    }

    return Math.round(reps * perRep);

  };

  const filteredWorkouts = useMemo(() => {

    return workouts.filter((w) => {

      const matchSearch = w.exercise
        .replaceAll("_", " ")
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchFilter =
        filterExercise === "all" ||
        w.exercise === filterExercise;

      return matchSearch && matchFilter;

    });

  }, [workouts, search, filterExercise]);

  const exercises = useMemo(() => {

    const set = new Set(workouts.map((w) => w.exercise));
    return ["all", ...Array.from(set)];

  }, [workouts]);

  return (

    <div className="history-wrapper">

      <h1 className="history-title">
        Workout History
      </h1>

      {/* SEARCH + FILTER */}

      <div className="history-controls">

        <div className="search-box">

          <span className="search-icon">🔍</span>

          <input
            type="text"
            placeholder="Search exercise..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

        </div>

        <select
          value={filterExercise}
          onChange={(e) => setFilterExercise(e.target.value)}
          className="history-filter"
        >

          {exercises.map((ex) => (

            <option key={ex} value={ex}>

              {ex === "all"
                ? "All Exercises"
                : ex.replaceAll("_", " ")}

            </option>

          ))}

        </select>

      </div>

      {loading ? (

        <div className="empty-state">
          Loading...
        </div>

      ) : filteredWorkouts.length === 0 ? (

        <div className="empty-state">
          No workouts recorded yet.
        </div>

      ) : (

        <div className="history-table">

          <div className="history-header">

            <span>Exercise</span>
            <span>Date</span>
            <span>Accuracy</span>
            <span>Reps</span>
            <span>Duration</span>
            <span>Calories</span>

          </div>

          {filteredWorkouts.map((workout) => (

            <div
              key={workout.id}
              className="history-row"
            >

              <span style={{ textTransform: "capitalize" }}>
                {workout.exercise.replaceAll("_", " ")}
              </span>

              <span>
                {workout.date}
              </span>

              <span
                className={`accuracy ${getAccuracyClass(workout.accuracy)}`}
              >
                {workout.accuracy}%
              </span>

              <span>
                {workout.reps}
              </span>

              <span>
                {workout.duration}s
              </span>

              <span>
                {calculateCalories(
                  workout.exercise,
                  workout.reps,
                  workout.duration
                )} kcal
              </span>

            </div>

          ))}

        </div>

      )}

    </div>

  );

}