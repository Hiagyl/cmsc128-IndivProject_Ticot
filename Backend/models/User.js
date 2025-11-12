const mongoose = require("mongoose");
const argon2 = require("argon2");

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
}, { timestamps: true });

// Hash password before saving
userSchema.pre("save", async function (next) {
    if (this.isModified("password")) {
        this.password = await argon2.hash(this.password);
    }
    next();
});

// Compare entered password with stored hash
userSchema.methods.comparePassword = function (candidatePassword) {
    return argon2.verify(this.password, candidatePassword);
};

module.exports = mongoose.model("User", userSchema);
