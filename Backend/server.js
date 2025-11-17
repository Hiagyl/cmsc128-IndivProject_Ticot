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

    jwt.verify(token, "secretkey", (err, user) => {
        if (err) return res.status(403).json({ message: "Invalid token" });
        req.user = user;
        next();
    });
};

// ---------------------- AUTH ROUTES ----------------------
app.post("/api/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ message: "Email already registered." });

        const newUser = new User({ name, email, password });
        await newUser.save();

        res.status(201).json({ message: "User registered successfully." });
    } catch (err) {
        res.status(500).json({ message: "Signup failed." });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ message: "Invalid email or password." });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ message: "Invalid email or password." });

        const token = jwt.sign(
            { id: user._id, email: user.email },
            "secretkey",
            { expiresIn: "1h" }
        );

        res.json({
            message: "Login successful",
            token,
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (err) {
        res.status(500).json({ message: "Login error." });
    }
});

app.put("/api/update", authenticateToken, async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const user = await User.findById(req.user.id);

        if (name) user.name = name;
        if (email) user.email = email;
        if (password && password.trim() !== "") user.password = password;

        await user.save();

        res.json({ message: "Profile updated.", user });
    } catch (err) {
        res.status(500).json({ message: "Update failed." });
    }
});

// ---------------------- TASK ROUTES ----------------------

// GET ALL TASKS for logged-in user
app.get("/api/tasks", authenticateToken, async (req, res) => {
    try {
        const { sort } = req.query;

        let tasks = await Task.find({ user: req.user.id, deleted: false }).lean();

        if (sort === "priority") {
            const order = { high: 1, mid: 2, low: 3 };
            tasks.sort((a, b) => order[a.priority] - order[b.priority]);
        }

        if (sort === "dueDate") {
            tasks.sort((a, b) =>
                (a.dueDate ? new Date(a.dueDate) : Infinity) -
                (b.dueDate ? new Date(b.dueDate) : Infinity)
            );
        }

        if (sort === "dateAdded") {
            tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        res.json(tasks);
    } catch (err) {
        res.status(500).json({ message: "Could not fetch tasks." });
    }
});

// CREATE TASK (linked to logged-in user)
app.post("/api/tasks", authenticateToken, async (req, res) => {
    try {
        const task = new Task({
            ...req.body,
            user: req.user.id
        });

        const saved = await task.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: "Could not create task." });
    }
});

// UPDATE USER'S TASK
app.put("/api/tasks/:id", authenticateToken, async (req, res) => {
    try {
        const updated = await Task.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { ...req.body, updatedAt: new Date() },
            { new: true }
        );

        if (!updated) return res.status(404).json({ message: "Task not found." });

        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: "Update failed." });
    }
});

// DELETE (soft delete)
app.delete("/api/tasks/:id", authenticateToken, async (req, res) => {
    try {
        const deleted = await Task.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { deleted: true, deletedAt: new Date() },
            { new: true }
        );

        if (!deleted) return res.status(404).json({ message: "Task not found." });

        res.json({ message: "Task deleted." });
    } catch (err) {
        res.status(500).json({ message: "Delete failed." });
    }
});

// RESTORE
app.post("/api/tasks/:id/restore", authenticateToken, async (req, res) => {
    try {
        const restored = await Task.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { deleted: false, deletedAt: null },
            { new: true }
        );

        if (!restored) return res.status(404).json({ message: "Task not found." });

        res.json({ message: "Task restored.", task: restored });
    } catch (err) {
        res.status(500).json({ message: "Restore failed." });
    }
});

// COMPLETE
app.patch("/api/tasks/:id/complete", authenticateToken, async (req, res) => {
    try {
        const completed = await Task.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { completed: true },
            { new: true }
        );

        if (!completed) return res.status(404).json({ message: "Task not found." });

        res.json({ message: "Task completed.", task: completed });
    } catch (err) {
        res.status(500).json({ message: "Complete failed." });
    }
});

// ---------------------- ERROR HANDLER (Must be last) ----------------------
app.use((err, req, res, next) => {
    logger.error(err);
    res.status(500).json({ message: "Internal server error" });
});

// ---------------------- Server ----------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
