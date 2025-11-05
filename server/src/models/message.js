import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true, 
    },
    sentBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    sentTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    content: {
        type: String,
    },
    type: {
        type: String,
        required: true,
    },
    delivered: {
        type: Boolean,
    },
    readBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }
})

