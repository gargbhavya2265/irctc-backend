const prisma = require('../config/prisma');

const getSchedulesSnapshot = async () => {
     const schedules = await prisma.scheduleInventory.findMany({
          select: {
               scheduleId: true,
               trainId: true,
               trainNumber: true,
               trainName: true,
               departureDate: true,
               totalSeats: true,
               available: true,
               locked: true,
               booked: true,
               status: true,
               version: true,
          },
          orderBy: [
               { departureDate: 'asc' },
               { trainNumber: 'asc' },
          ],
     });

     return {
          totalSchedules: schedules.length,
          schedules,
     };
};

module.exports = {
     getSchedulesSnapshot,
};