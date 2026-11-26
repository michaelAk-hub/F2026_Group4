const violation = require('../models/violation');
const parkingSpot = require('../models/parkingSpot');
const reservation = require('../models/reservation');
const notification = require('../models/notification');

async function findActiveReservation(spotId, status, time)
{
    const res = reservation.findOne({
                            parkingSpotID: spotId, reservationStatus: status,
                            reservationStartTime: {$lte: time}, reservationEndTime: {$gte: time}
                        });
    return res;
}

async function checkViolations(parkingSpotId, now = new Date())
{
    let result;
    if(await findActiveReservation(parkingSpotId, 'Paid', now) !== null) return null; // No violations

    const res = await findActiveReservation(parkingSpotId, 'Unpaid', now)

    if( res !== null)
        result = await recordViolation(parkingSpotId, 'Unpaid reservation', res.userID, now);
    else result = await recordViolation(parkingSpotId, 'Unreserved parking', undefined, now);
    if(result.created && res)
        await notifyUser(res.userID, result.violation);

    return result;
}

async function recordViolation(spotId, type, userId, now)
{
    const data = {violationType: type, violationDate: now};

    if (userId)
        data.userID=userId;

    try
    {
        const result = await violation.updateOne({parkingSpotID: spotId, violationStatus: 'Unresolved'}, { $setOnInsert: data}, {upsert: true});
        const created = (result.upsertedCount === 1);

        let vio = await violation.findOne({parkingSpotID: spotId, violationStatus: 'Unresolved'});
    
        return {violation: vio, created};
    } catch (error)
    {
        if(error.code === 11000)
        {
            let viol = await violation.findOne({parkingSpotID: spotId, violationStatus: 'Unresolved'});
            return {violation: viol, created: false}
        }
        else throw error;
    }
    
}

async function notifyUser(userId, vio)
{
    let notif = null;
    try
    {
        const spot = await parkingSpot.findById(vio.parkingSpotID);
        let violationMessage, locationMessage;

        locationMessage = spot && spot.spotLocation ? spot.spotLocation : 'your reserved spot';

        if(vio.violationType === "Unreserved parking") // In case it's ever needed in the future
            violationMessage = "You have parked without a reservation. Please reserve the spot you wish to park in.";
        else
            violationMessage = "The spot is occupied but your reservation has not been paid. Please complete the payment.";

        const message = "A parking spot violation was recorded in " + locationMessage + ": " + violationMessage;

        notif = await notification.create({userID: userId, violationID: vio._id, notificationMessage: message});
    }
    catch (error)
    {
        console.error("Violation Service Error: " + error);
    }

    if(notif)
        return notif;
    return null;
}

module.exports = {checkViolations, recordViolation, notifyUser};