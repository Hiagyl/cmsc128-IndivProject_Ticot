// models/Task.js
const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true   // task must have an owner
    },

    title: { type: String, required: true },
    description: { type: String },

    priority: { type: String, enum: ["high", "mid", "low"], default: "mid" },

    dueDateString: { type: String },
    dueDate: { type: Date },

    mode: { type: String, enum: ["personal", "collaborative"], default: "personal" },

    collaborators: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],

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
