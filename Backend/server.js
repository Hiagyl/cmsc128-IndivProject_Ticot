const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const morgan = require("morgan");
const winston = require("winston");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");

const Task = require("./models/Task");
const User = require("./models/User");

const app = express();

// ----- Middleware -----
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ----- MongoDB -----
mongoose
    .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/tasks")
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => console.error("MongoDB connection error:", err));

// ----- Logger -----
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

const apiLogger = (req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        logger.info({
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration: `${duration}ms`,
            params: req.params,
            query: req.query,
            body: req.method !== "GET" ? req.body : undefined,
        });
    });
    next();
};
app.use(apiLogger);

app.use((err, req, res, next) => {
    logger.error({
        message: err.message,
        stack: err.stack,
        method: req.method,
        path: req.path,
        params: req.params,
        query: req.query,
        body: req.method !== "GET" ? req.body : undefined,
    });
    res.status(500).json({ message: "Internal server error" });
});

// ----- AUTH HELPERS -----
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "No token provided" });

    const token = authHeader.split(" ")[1];
    jwt.verify(token, "secretkey", (err, user) => {
        if (err) return res.status(403).json({ message: "Invalid token" });
        req.user = user;
        next();
    });
};

// ----- AUTH ROUTES -----
app.post("/api/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password)
            return res.status(400).json({ message: "All fields are required." });

        const existingUser = await User.findOne({ email });
        if (existingUser)
            return res.status(400).json({ message: "Email already registered." });

        const newUser = new User({ name, email, password }); 
        await newUser.save();

        logger.info(`User registered: ${email}`);
        res.status(201).json({ message: "User registered successfully." });
    } catch (error) {
        logger.error("Error during signup:", error);
        res.status(500).json({ message: "Server error." });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password)
            return res.status(400).json({ message: "Email and password required." });

        const user = await User.findOne({ email });
        if (!user)
            return res.status(401).json({ message: "Invalid email or password." });

        const isMatch = await user.comparePassword(password);
        if (!isMatch)
            return res.status(401).json({ message: "Invalid email or password." });

        const token = jwt.sign({ id: user._id, email: user.email }, "secretkey", { expiresIn: "1h" });

        logger.info(`User logged in: ${email}`);
        res.status(200).json({
            message: "Login successful.",
            token,
            user: { id: user._id, name: user.name, email: user.email },
        });
    } catch (error) {
        logger.error("Error during login:", error);
        res.status(500).json({ message: "Server error." });
    }
});

app.put("/api/update", authenticateToken, async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (name) user.name = name;
        if (email) user.email = email;
        if (password && password.trim() !== "") {
            user.password = password; // hashed by pre-save hook
        }

        await user.save();

        res.status(200).json({
            message: "Profile updated successfully",
            user: { id: user._id, name: user.name, email: user.email },
        });
    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ----- TASK ROUTES -----
app.get("/api/tasks", async (req, res) => {
    try {
        const { sort } = req.query;
        let tasks;

        if (sort === "priority") {
            tasks = await Task.find({ deleted: false }).lean();
            const order = { high: 1, mid: 2, low: 3 };
            tasks.sort((a, b) => (order[a.priority] || 999) - (order[b.priority] || 999));
        } else if (sort === "dueDate") {
            tasks = await Task.find({ deleted: false }).lean();
            tasks.sort((a, b) => (a.dueDate ? new Date(a.dueDate) : Infinity) - (b.dueDate ? new Date(b.dueDate) : Infinity));
        } else if (sort === "dateAdded") {
            tasks = await Task.find({ deleted: false }).sort({ createdAt: -1 }).lean();
        } else {
            tasks = await Task.find({ deleted: false }).lean();
        }

        logger.info(`Retrieved ${tasks.length} tasks successfully`);
        res.json(tasks);
    } catch (error) {
        logger.error("Error fetching tasks:", error);
        res.status(500).json({ message: error.message });
    }
});

app.post("/api/tasks", async (req, res) => {
    try {
        const task = new Task(req.body);
        const savedTask = await task.save();
        logger.info("New task created:", { taskId: savedTask._id, title: savedTask.title });
        res.status(201).json(savedTask);
    } catch (error) {
        logger.error("Error creating task:", error);
        res.status(400).json({ message: error.message });
    }
});

app.put("/api/tasks/:id", async (req, res) => {
    try {
        const task = await Task.findByIdAndUpdate(
            req.params.id,
            { ...req.body, deleted: false, deletedAt: null },
            { new: true, runValidators: true }
        );
        if (!task) return res.status(404).json({ message: "Task not found" });

        logger.info("Task updated successfully:", { taskId: task._id, title: task.title });
        res.json(task);
    } catch (error) {
        logger.error("Error updating task:", error);
        res.status(400).json({ message: error.message });
    }
});

app.delete("/api/tasks/:id", async (req, res) => {
    try {
        const task = await Task.findByIdAndUpdate(req.params.id, { deleted: true, deletedAt: new Date() }, { new: true });
        if (!task) return res.status(404).json({ message: "Task not found" });

        logger.info("Task deleted successfully", { taskId: task._id, title: task.title });
        res.json({ message: "Task deleted successfully" });
    } catch (error) {
        logger.error("Error deleting task:", error);
        res.status(500).json({ message: error.message });
    }
});

app.post("/api/tasks/:id/restore", async (req, res) => {
    try {
        const task = await Task.findByIdAndUpdate(
            req.params.id,
            { deleted: false, deletedAt: null },
            { new: true }
        );
        if (!task) return res.status(404).json({ message: "Task not found" });

        logger.info("Task restored successfully", { taskId: task._id, title: task.title });
        res.json({ message: "Task restored successfully", task });
    } catch (error) {
        logger.error("Error restoring task:", error);
        res.status(500).json({ message: error.message });
    }
});

app.patch("/api/tasks/:id/complete", async (req, res) => {
    try {
        const task = await Task.findByIdAndUpdate(req.params.id, { completed: true }, { new: true });
        if (!task) return res.status(404).json({ message: "Task not found" });

        logger.info("Task marked as completed", { taskId: task._id, title: task.title });
        res.json({ message: "Task marked as completed", task });
    } catch (error) {
        logger.error("Error marking task as completed:", error);
        res.status(500).json({ message: error.message });
    }
});

// ----- Server -----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
