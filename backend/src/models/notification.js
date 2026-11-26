const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema
(
    {
        notificationMessage:
        {
            type: String,
            required: true
        },
/*
        notificationRead://Marked true if the user opens the notification. Uncomment when notifications page is built
        {
            type: Boolean,
            default: false
        },
*/
        userID:
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },

        violationID:
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Violation',
            required: true
        }
    },
    {timestamps: true}
);

module.exports = mongoose.model('Notification',notificationSchema);