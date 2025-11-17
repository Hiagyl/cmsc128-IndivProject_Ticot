const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const morgan = require("morgan");
const winston = require("winston");
const jwt = require("jsonwebtoken");

const Task = require("./models/Task");
const User = require("./models/User");

const app = express();

// ---------------------- Middleware ----------------------
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ---------------------- MongoDB ----------------------
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/tasks")
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

// ---------------------- Logger ----------------------
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

app.use(morgan(":method :url :status :response-time ms - :res[content-length]"));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${Date.now() - start}ms`,
      params: req.params,
      query: req.query,
      body: req.method !== "GET" ? req.body : undefined,
    });
  });
  next();
});

// ---------------------- Auth Middleware ----------------------
const authenticateToken = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: "No token provided" });

  const token = auth.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET || "secretkey", (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
};

// ---------------------- AUTH ROUTES ----------------------
app.post("/api/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields are required." });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email already registered." });

    const newUser = new User({ name, email, password });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Signup failed." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required." });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid email or password." });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: "Invalid email or password." });

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "1h" }
    );

    res.json({
      message: "Login successful",
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login error." });
  }
});

app.put("/api/update", authenticateToken, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (name) user.name = name;
    if (email) user.email = email;
    if (password && password.trim() !== "") user.password = password;

    await user.save();

    res.json({ message: "Profile updated.", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Update failed." });
  }
});

// ---------------------- TASK ROUTES ----------------------

// GET ALL TASKS
app.get("/api/tasks", authenticateToken, async (req, res) => {
    try {
        const { sort, mode } = req.query;

        let query = { deleted: false };

        if (mode === "collaborative") {
            query = {
                deleted: false,
                mode: "collaborative",
                $or: [
                    { ownerId: req.user.id },
                    { collaborators: req.user.id }
                ]
            };
        } else {
            // default: personal
            query = { deleted: false, ownerId: req.user.id, mode: "personal" };
        }

        let tasks = await Task.find(query).lean();

        if (sort === "priority") {
            const order = { high: 1, mid: 2, low: 3 };
            tasks.sort((a, b) => order[a.priority] - order[b.priority]);
        } else if (sort === "dueDate") {
            tasks.sort((a, b) => (a.dueDate ? new Date(a.dueDate) : Infinity) - (b.dueDate ? new Date(b.dueDate) : Infinity));
        } else if (sort === "dateAdded") {
            tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        res.json(tasks);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Could not fetch tasks." });
    }
});


// CREATE TASK
app.post("/api/tasks", authenticateToken, async (req, res) => {
  try {
    const { title, dueDate, priority, completed, mode, collaborators } = req.body;

    if (!title) return res.status(400).json({ message: "Title is required" });

    const task = new Task({
      title,
      dueDate: dueDate ? new Date(dueDate) : null,
      priority: ["high", "mid", "low"].includes(priority) ? priority : "mid",
      completed: completed ?? false,
      deleted: false,
      mode: mode === "collaborative" ? "collaborative" : "personal",
      ownerId: req.user.id,
      collaborators: mode === "collaborative" ? collaborators || [] : []
    });

    const saved = await task.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Could not create task", error: err.message });
  }
});


// UPDATE TASK
app.put("/api/tasks/:id", authenticateToken, async (req, res) => {
  try {
    const updated = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Task not found." });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Update failed." });
  }
});

// DELETE TASK (soft delete)
app.delete("/api/tasks/:id", authenticateToken, async (req, res) => {
  try {
    const deleted = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { deleted: true, deletedAt: new Date() },
      { new: true }
    );

    if (!deleted) return res.status(404).json({ message: "Task not found." });
    res.json({ message: "Task deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete failed." });
  }
});

// RESTORE TASK
app.post("/api/tasks/:id/restore", authenticateToken, async (req, res) => {
  try {
    const restored = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { deleted: false, deletedAt: null },
      { new: true }
    );

    if (!restored) return res.status(404).json({ message: "Task not found." });
    res.json({ message: "Task restored.", task: restored });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Restore failed." });
  }
});

// COMPLETE TASK
app.patch("/api/tasks/:id/complete", authenticateToken, async (req, res) => {
  try {
    const completed = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { completed: true, updatedAt: new Date() },
      { new: true }
    );

    if (!completed) return res.status(404).json({ message: "Task not found." });
    res.json({ message: "Task completed.", task: completed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Complete failed." });
  }
});

// ---------------------- ERROR HANDLER ----------------------
app.use((err, req, res, next) => {
    logger.error(err);
    res.status(500).json({ message: "Internal server error" });
});

// ---------------------- Server ----------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
