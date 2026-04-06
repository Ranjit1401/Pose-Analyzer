import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../api/auth";
import { useAuth } from "../context/AuthContext";

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await loginUser({
        email: form.email,
        password: form.password,
      });

      console.log("LOGIN RESPONSE:", res.data);

      // ✅ Check if login successful
      if (res.status === 200 && res.data.access_token) {
        // Save token
        localStorage.setItem("token", res.data.access_token);

        // Update auth context
        login(form.email);

        // Redirect user
        navigate("/home");
      } else {
        setError("Login failed - no token received");
      }

    } catch (err) {
      console.log("LOGIN ERROR:", err);

      // Show proper error message
      if (err.response) {
        setError(err.response.data.detail || "Invalid credentials");
      } else {
        setError("Server error. Try again.");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Login</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <input
        type="email"
        placeholder="Email"
        value={form.email}
        onChange={(e) =>
          setForm({ ...form, email: e.target.value })
        }
        required
      />

      <input
        type="password"
        placeholder="Password"
        value={form.password}
        onChange={(e) =>
          setForm({ ...form, password: e.target.value })
        }
        required
      />

      <button type="submit">Login</button>
    </form>
  );
}

export default Login;