const mongoose = require('mongoose');

const ParkingSpot = require('../src/models/parkingSpot');
const Reservation = require('../src/models/reservation');
const Violation = require('../src/models/violation');
const Notification = require('../src/models/notification');
const { checkViolations, notifyUser } = require('../src/services/violationService');
const { startTestDB, clearTestDB, stopTestDB } = require('./setup');

const NOW = new Date();

async function createReservation(spotID = new mongoose.Types.ObjectId(), start = new Date(NOW.getTime() - 60 * 60 * 1000),
                                end = new Date(NOW.getTime() + (1000 * 60 * 60)), status = 'Unpaid', userID = new mongoose.Types.ObjectId())
{

    const res = await Reservation.create({reservationStartTime: start,
                                        reservationEndTime: end,
                                        reservationStatus: status,
                                        userID: userID,
                                        parkingSpotID: spotID,
                                        paymentID: new mongoose.Types.ObjectId()
                                        });

    return res;
}

async function startDB()
{
    await startTestDB();
    await Violation.init();
}

async function clearDB()
{
    await clearTestDB();
    jest.restoreAllMocks();
}

describe('Violation and Notification tests', () => {

    beforeAll(startDB);
    afterEach(clearDB);
    afterAll(stopTestDB);
    
    // #################################### VIOLATION TESTS ######################################
    test('TC-G98: No reservation gives \"Unreserved parking\" violation and no user', async () => {
        const spot = await ParkingSpot.create({ spotLocation: 'A1' })
        const result = await checkViolations(spot._id, NOW);
        const vio = result.violation;


        expect(result.created).toBe(true);
        expect(await Violation.countDocuments()).toBe(1);

        expect(vio.violationType).toBe('Unreserved parking');
        expect(vio.userID).toBeUndefined();
        expect(vio.violationStatus).toBe('Unresolved');
        expect(vio.violationDate).toEqual(NOW);
    });

    test('TC-G99: Active Paid reservation gives null violation', async () => {
        const spot = await ParkingSpot.create({ spotLocation: 'A1' })
        const res = await createReservation(spot._id, new Date(NOW.getTime() - 60 * 60 * 1000), new Date(NOW.getTime() + 60 * 60 * 1000),'Paid');

        const result = await checkViolations(res.parkingSpotID, NOW);

        expect(result).toBe(null);
        expect(await Violation.countDocuments()).toBe(0);
    });

    test('TC-G100: Active Unpaid reservation gives \"Unpaid reservation\" with reservation\'s userId', async () => {
        const spot = await ParkingSpot.create({ spotLocation: 'A1' })
        const res = await createReservation( spot._id, new Date(NOW.getTime() - 60 * 60 * 1000), new Date(NOW.getTime() + 60 * 60 * 1000),'Unpaid');

        const result = await checkViolations(res.parkingSpotID, NOW);
        const vio = result.violation;

        expect(result.created).toBe(true);
        expect(await Violation.countDocuments()).toBe(1);

        expect(vio.violationType).toBe('Unpaid reservation');
        expect(String(vio.userID)).toBe(String(res.userID)) ;
    });

    //spotID, start, end, status, userID
    test('TC-G101: Paid reservation that ended or hasn\'t started yet gives an unreserved parking spot', async () => {
        const spotBefore = await ParkingSpot.create({ spotLocation: 'A1' })
        const spotAfter = await ParkingSpot.create({ spotLocation: 'A2' })

        const resBefore = await createReservation(spotBefore._id, new Date(NOW.getTime() - 60 * 60 * 1000), new Date(NOW.getTime() - 3000), 'Paid');
        const resAfter = await createReservation(spotAfter._id, new Date(NOW.getTime() + 60 * 60 * 1000), new Date(NOW.getTime() + 60 * 60 * 2000), 'Paid');

        const resultBefore = await checkViolations(resBefore.parkingSpotID, NOW);
        const vioBefore = resultBefore.violation;
        const resultAfter = await checkViolations(resAfter.parkingSpotID, NOW);
        const vioAfter = resultAfter.violation;

        expect(vioBefore.violationType).toBe('Unreserved parking');
        expect(vioAfter.violationType).toBe('Unreserved parking');
    });

    test('TC-G102: Calling violation check twice gives one violation', async () => {
        const spot = await ParkingSpot.create({ spotLocation: 'A1' })
        const result1 = await checkViolations(spot._id, NOW);
        const result2 = await checkViolations(spot._id, NOW);

        expect(result1.created).toBe(true);
        expect(result2.created).toBe(false);
        expect(await Violation.countDocuments()).toBe(1);
    });

    test('TC-G103: Two calls at the same time give one violation', async () => {
        const spot = await ParkingSpot.create({ spotLocation: 'A1' })

        const results = await Promise.all(
        [
            checkViolations(spot._id, NOW),
            checkViolations(spot._id, NOW),
            checkViolations(spot._id, NOW),
            checkViolations(spot._id, NOW),
            checkViolations(spot._id, NOW),

        ]);

        expect(results.every((r) => r !== null)).toBe(true); //None is null. The calls that lost the race return the existing violation
        expect(results.filter((r) => r.created)).toHaveLength(1); //Exactly one call creates the violation

        const ids = new Set(results.map((r) => String(r.violation._id)));
        expect(ids.size).toBe(1); //All results point to the same violation

        expect(await Violation.countDocuments()).toBe(1); //Only one violation is saved
    });

    test('TC-G104: When a violation is resolved, a new call creates a second violation', async () => {
        const spot = await ParkingSpot.create({ spotLocation: 'A1' })
        const first = await checkViolations(spot._id, NOW);

        expect(first.created).toBe(true);

        await Violation.updateOne({_id: first.violation._id}, {$set: {violationStatus: 'Resolved'}});

        const second = await checkViolations(spot._id, NOW);

        expect(second.created).toBe(true);
        expect(String(second.violation._id)).not.toBe(String(first.violation._id));

        expect(await Violation.countDocuments()).toBe(2);
        expect(await Violation.countDocuments({violationStatus: 'Resolved'})).toBe(1);
        expect(await Violation.countDocuments({violationStatus: 'Unresolved'})).toBe(1);

        const old = await Violation.findById(first.violation._id);
        expect(old.violationStatus).toBe('Resolved');
    });

    //######################## NOTIFICATION TESTS #############################
    test('TC-G105: Active, Unpaid reservation produces exactly one notification', async () => {
        const spot = await ParkingSpot.create({spotLocation: 'A1'});

        const res = await createReservation(spot._id, new Date(NOW.getTime() - 60 * 60 * 1000), new Date(NOW.getTime() + 60 * 60 * 1000), 'Unpaid');
        
        const result = await checkViolations(res.parkingSpotID, NOW);
        const vio = result.violation;

        const notif = await Notification.findOne({userID: res.userID, violationID: vio._id});


        expect(notif).not.toBeNull();
        expect( String(res.userID) ).toBe( String(vio.userID) );
        expect(notif.notificationMessage).toContain('A1');
        expect(await Notification.countDocuments()).toBe(1);
    });

    test('TC-G106: Unreserved parking produces no notification', async () => {
        const spot = await ParkingSpot.create({spotLocation: 'A1'});

        await checkViolations(spot._id, NOW);

        expect(await Notification.countDocuments()).toBe(0);
    });
//spotID, start, end, status, uid
    test('TC-G107: Checking violations twice for an Unpaid case leaves only one notification', async () => {
        const spot = await ParkingSpot.create({spotLocation: 'A1'});
        const res = await createReservation(spot._id, new Date(NOW.getTime() - 60 * 60 * 1000), new Date(NOW.getTime() + 60 * 60 * 1000), 'Unpaid');


        const result1 = await checkViolations(res.parkingSpotID, NOW);
        const result2 = await checkViolations(res.parkingSpotID, NOW);

        expect(await Notification.countDocuments()).toBe(1);
        expect(result1.created).toBe(true);
        expect(result2.created).toBe(false);
    });

    test('TC-G108: A notification failure doesn\'t hide the violation', async () => {
        const spot = await ParkingSpot.create({spotLocation: 'A1'});
        const res = await createReservation(spot._id, new Date(NOW.getTime() - 60 * 60 * 1000), new Date(NOW.getTime() + 60 * 60 * 1000), 'Unpaid');

        jest.spyOn(Notification, 'create').mockRejectedValue(new Error('fail'));

        const result = await checkViolations(res.parkingSpotID, NOW);
        const vio = result.violation;

        expect(await Violation.findOne({_id: vio._id})).not.toBe(null);
        expect(await Notification.countDocuments()).toBe(0);
        expect(result.created).toBe(true);

    });
});