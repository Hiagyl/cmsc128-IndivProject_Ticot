const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const morgan = require("morgan");
const winston = require("winston");
const Task = require("./models/Task")

const app = express();

//Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

mongoose
    .connect(
        process.env.MONGODB_URI || "mongodb://localhost:27017"
    )
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => console.error("MongoDB connection error:", err));

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

app.use(
    morgan(":method :url :status :response-time ms - :res[content-length]")
);

const apiLogger = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info({
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration: `${duration}ms`,
            params: req.params,
            query: req.query,
            body: req.method !== 'GET' ? req.body : undefined
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
        body: req.method !== 'GET' ? req.body : undefined
    });

    res.status(500).json({ message: 'Internal server error' });
});

app.get("/api/tasks", async (req, res) => {
    try {
        const { sort } = req.query;
        let sortOption = {}

        if (sort === "dateAdded") sortOption = { createdAt: -1 };
        else if (sort === "dueDate") sortOption = { dueDate: 1 };
        else if (sort === "priority") sortOption = {
            priority: { $function: { body: 'function(p){return (p=="high"?1:(p=="mid"?2:3));}', args: ["$priority"], lang: "js" } }
        };

        const tasks = (await Task.find({ deleted: false })).sort(sortOption);
        logger.info(`Retrieved ${tasks.length} tasks successfully`)
        res.json(tasks);
    } catch (error) {
        logger.error("Error fetching tasks:", error);
        res.status(500).json({ message: error.message });
        // next(error);
    }
});

app.post("/api/tasks", async (req, res) => {
    try {
        const task = new Task(req.body);
        const savedTask = await task.save();
        logger.info("New task created:", {
            taskId: savedTask._id,
            title: savedTask.title,
        });
        res.status(201).json(savedTask);
    } catch (error) {
        logger.error("Error creating task:", error)
        res.status(400).json({ message: error.message });
    }
});

app.put("/api/tasks/:id", async (req, res) => {
    try {
        const task = await Task.findByIdAndUpdate(req.params.id, { deleted: false, deletedAt: null }, { new: true });
        if (!task) {
            logger.warn("Task not found for update:", { taskId: req.params.id });
            return res.status(404).json({ message: "Task not found" });
        }
        logger.info("Task updated successfully:", {
            taskId: task._id,
            title: task.title,
        });
        res.json(task);
    } catch (error) {
        logger.error("Error updating task:", error);
        res.status(400).json({ message: error.message });
    }
});

app.delete("/api/tasks/:id", async (req, res) => {
    try {
        const task = await Task.findByIdAndUpdate(req.params.id, { deleted: true, deletedAt: new Date() }, { new: true });
        if (!task) {
            logger.warn("Task not found for deletion:", {
                taskId: req.params.id,
            });
            return res.status(404).json({ message: "Task not found" });
        }
        logger.info("Task deleted successfully", {
            taskId: task._id,
            title: task.name,
        });
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

        if (!task) {
            logger.warn("Task not found for restore:", {
                taskId: req.params.id,
            });
            return res.status(404).json({ message: "Task not found" });
        }

        logger.info("Task restored successfully", {
            taskId: task._id,
            title: task.title,
        });

        res.json({ message: "Task restored successfully", task });
    } catch (error) {
        logger.error("Error restoring task:", error);
        res.status(500).json({ message: error.message });
    }
});

app.patch("/api/tasks/:id/complete", async (req, res) => {
    try {
        const task = await Task.findByIdAndUpdate(
            req.params.id,
            { completed: true },
            { new: true }
        );

        if (!task) {
            logger.warn("Task not found for completion:", {
                taskId: req.params.id,
            });
            return res.status(404).json({ message: "Task not found" });
        }

        logger.info("Task marked as completed", {
            taskId: task._id,
            title: task.title,
        });

        res.json({ message: "Task marked as completed", task });
    } catch (error) {
        logger.error("Error marking task as completed:", error);
        res.status(500).json({ message: error.message });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});