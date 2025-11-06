import { createAdapter } from "@socket.io/redis-adapter";
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
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
    createdAt: {
        type: Date,
        required: true,
    },
    lastSeen: {
        type: Date,
    },
    roles: {
        type: [String],
        default: ["user"]
    }
});

export const User = mongoose.model('User', UserSchema)
