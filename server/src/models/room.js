import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true, // remove whitespace
        index: true, 
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true,
    },
    passwordHash: {
        type: String,
        required: true
    },
    displayName: {
        type: String,
        trim: true,
    },
    avatarUrl: {
        type: String,
    },
    lastSeen: {
        type: Date,
    },
    roles: {
        type: [String],
        default: ["user"],
    },
    }, 
    {
        timestamps: true, // adds createdAt and updatedAt automatically.
    }
);

export const Room = mongoose.model("Room", roomSchema);
