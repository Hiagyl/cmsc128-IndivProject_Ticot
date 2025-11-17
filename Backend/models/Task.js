// models/Task.js
const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true   // ensures every task belongs to a user
    },

    title: { type: String, required: true },
    description: { type: String },

    priority: { type: String, enum: ["high", "mid", "low"], default: "mid" },

    dueDateString: { type: String },
    dueDate: { type: Date },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },

    completed: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date }
});

taskSchema.pre("save", function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model("Task", taskSchema);
