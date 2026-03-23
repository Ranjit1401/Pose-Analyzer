# 🧠 AI Posture Analyzer & Fitness Tracker

AI Posture Analyzer is a web application that uses **computer vision and AI pose detection** to analyze a user's exercise posture in real time using the device camera. The system detects body movements, counts repetitions, calculates calories burned, and stores workout history for each user.

This project combines **AI pose estimation, full-stack development, and fitness tracking** to help users perform exercises with the correct posture.

---

# 🚀 Features

## 🔐 Authentication
- User Signup
- User Login
- JWT-based authentication
- Secure protected routes

## 📷 Real-Time Pose Detection
- Detects human body joints using AI
- Uses webcam to analyze posture
- Provides real-time feedback

## 🏋️ Exercise Tracking
- Detects and counts exercise repetitions
- Calculates calories burned
- Supports multiple exercises

### Supported Exercises
- Squats
- Pushups
- Lunges
- Jumping Jacks

## 📊 User Dashboard
Displays important fitness information:

- Total workouts
- Total calories burned
- Exercise statistics
- Workout graphs

## 📜 Workout History
Each workout session is stored with:
- Exercise name
- Repetition count
- Calories burned
- Date and time

## 👤 User Profile
Users can view:

- Name
- Email
- Total calories burned
- Exercise stats
- Workout history

---

# 🏗️ Tech Stack

## Frontend
- React.js
- Tailwind CSS
- Axios
- Chart.js

## Backend
- Python
- FastAPI

## AI / Computer Vision
- MediaPipe
- OpenCV

## Database
- PostgreSQL

## Authentication
- JWT (JSON Web Tokens)

---

# 📂 Project Structure

```
project-root
│
├── frontend
│   ├── src
│   │   ├── pages
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Profile.jsx
│   │   │   ├── Workout.jsx
│   │   │
│   │   ├── components
│   │   ├── services
│   │   ├── config
│   │   │   └── api.js
│   │   └── App.jsx
│
├── backend
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── auth.py
│   ├── routes
│   │   ├── auth_routes.py
│   │   └── workout_routes.py
│   └── pose_detection.py
│
└── README.md
```

---

# ⚙️ Installation

## 1️⃣ Clone the Repository

```bash
git clone https://github.com/your-username/ai-posture-analyzer.git
cd ai-posture-analyzer
```

---

# 🖥️ Backend Setup

### 1. Go to backend folder

```bash
cd backend
```

### 2. Create virtual environment

```bash
python -m venv venv
```

### 3. Activate virtual environment

Windows

```bash
venv\Scripts\activate
```

Mac/Linux

```bash
source venv/bin/activate
```

### 4. Install dependencies

```bash
pip install -r requirements.txt
```

### 5. Run backend server

```bash
uvicorn main:app --reload
```

Backend will run on

```
http://127.0.0.1:8000
```

---

# 💻 Frontend Setup

### 1. Go to frontend folder

```bash
cd frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start frontend

```bash
npm run dev
```

Frontend will run on

```
http://localhost:5173
```

---

# 📊 API Endpoints

## Authentication

```
POST /register
POST /login
```

## Workout

```
POST /save-workout
GET /history
```

---

# 📸 Screenshots

You can add screenshots here.

Example:

```
/screenshots/login.png
/screenshots/workout.png
/screenshots/profile.png
```

---

# 🎯 Future Improvements

- AI voice coach for workout guidance
- More exercise detection
- Mobile responsive UI improvements
- Real-time posture correction alerts
- Fitness progress analytics
- Mobile application

---

# 🤝 Contributing

Contributions are welcome.

Steps:

1. Fork the repository
2. Create a new branch
3. Make changes
4. Submit a pull request

---

# 📄 License

This project is licensed under the MIT License.

---

# 👨‍💻 Author

**Ranjit Bhardwaj**

BTech CSE (AI & ML)  
AI & Web Development Enthusiast

GitHub: https://github.com/Ranjit1401
Email: ranjitbhardwaj1401@gmail.com