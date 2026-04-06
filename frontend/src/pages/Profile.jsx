import { useEffect, useState } from "react";
import ProgressHeatmap from "../components/ProgressHeatmap";
import "../styles/Profile.css";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar
} from "recharts";

export default function Profile() {

  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [progressData, setProgressData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [exerciseData, setExerciseData] = useState([]);
  const [timeSpent, setTimeSpent] = useState([]);
  const [exerciseBars, setExerciseBars] = useState([]);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {

    const fetchProfile = async () => {

      try {

        const token = localStorage.getItem("token");

        const res = await fetch('https://postureai-backend.onrender.com/api/profile', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const data = await res.json();

        setUser(data.user);
        setStats(data.stats);

        setProgressData(data.progress || []);
        setWeeklyData(data.weekly || []);
        setExerciseData(data.exerciseDistribution || []);
        setTimeSpent(data.timeSpent || []);

        setExerciseBars(data.exerciseDistribution || []);

        setName(data.user?.name || "");

      } catch (err) {

        console.error("Profile fetch error:", err);

      }

    };

    fetchProfile();

  }, []);

  const COLORS = [
    "#7c3aed",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#3b82f6",
    "#14b8a6"
  ];

  const saveProfile = () => {
    setUser({ ...user, name });
    setEditing(false);
  };

  return (

    <div className="profile-wrapper">

      {/* ================= USER INFO ================= */}

      <section className="profile-identity">

        <div className="avatar">
          {name?.charAt(0) || "U"}
        </div>

        <div className="identity-info">

          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="edit-input"
            />
          ) : (
            <h2>{name || "User Name"}</h2>
          )}

          <p>{user?.email || "user@email.com"}</p>

          <p className="join-date">
            Joined: {user?.joinDate || "-"}
          </p>

        </div>

        {editing ? (
          <button className="edit-btn" onClick={saveProfile}>
            Save
          </button>
        ) : (
          <button className="edit-btn" onClick={() => setEditing(true)}>
            Edit Profile
          </button>
        )}

      </section>

      {/* ================= STATS ================= */}

      <section className="profile-stats">

        <div className="stat-card">
          <h3>{stats?.totalWorkouts || 0}</h3>
          <p>Total Workouts</p>
        </div>

        <div className="stat-card">
          <h3>{stats?.avgAccuracy || 0}%</h3>
          <p>Avg Accuracy</p>
        </div>

        <div className="stat-card">
          <h3>{stats?.totalCalories || 0}</h3>
          <p>Total Calories</p>
        </div>

        <div className="stat-card">
          <h3>{stats?.streak || 0}</h3>
          <p>Day Streak</p>
        </div>

      </section>

      {/* ================= HEATMAP ================= */}

      <section className="profile-progress">

        <div className="progress-header">
          <h2>Workout Activity</h2>
        </div>

        {progressData.length === 0 ? (
          <div className="empty-state">
            No activity data available.
          </div>
        ) : (
          <ProgressHeatmap data={progressData} />
        )}

      </section>

      {/* ================= WEEKLY ACCURACY ================= */}

      <section className="profile-progress">

        <div className="progress-header">
          <h2>Weekly Accuracy</h2>
        </div>

        <ResponsiveContainer width="100%" height={300}>

          <LineChart data={weeklyData}>

            <XAxis dataKey="date"/>

            <YAxis/>

            <Tooltip/>

            <Line
              type="monotone"
              dataKey="accuracy"
              stroke="#7c3aed"
              strokeWidth={3}
            />

          </LineChart>

        </ResponsiveContainer>

      </section>

      {/* ================= EXERCISE DISTRIBUTION ================= */}

      <section className="profile-progress">

        <div className="progress-header">
          <h2>Exercise Distribution</h2>
        </div>

        <ResponsiveContainer width="100%" height={300}>

          <PieChart>

            <Pie
              data={exerciseData}
              dataKey="value"
              nameKey="exercise"
              outerRadius={100}
              label
            >

              {exerciseData.map((entry, index) => (

                <Cell
                  key={index}
                  fill={COLORS[index % COLORS.length]}
                />

              ))}

            </Pie>

            <Legend/>

            <Tooltip/>

          </PieChart>

        </ResponsiveContainer>

      </section>

      {/* ================= TIME EXERCISED ================= */}

      <section className="profile-progress">

        <div className="progress-header">
          <h2>Time Exercised</h2>
        </div>

        <ResponsiveContainer width="100%" height={300}>

          <BarChart data={timeSpent}>

            <XAxis dataKey="day"/>

            <YAxis/>

            <Tooltip/>

            <Bar dataKey="time" fill="#7c3aed"/>

          </BarChart>

        </ResponsiveContainer>

      </section>

    </div>

  );

}