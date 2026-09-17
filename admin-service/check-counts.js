const prisma = require('./src/config/prisma');
async function main() {
  const stations = await prisma.station.count();
  const trains = await prisma.train.count();
  const seats = await prisma.seat.count();
  const routes = await prisma.route.count();
  const routeStations = await prisma.routeStation.count();
  const schedules = await prisma.schedule.count();
  console.log('CURRENT DATABASE COUNTS');
  console.log('Stations:', stations);
  console.log('Trains:', trains);
  console.log('Seats:', seats);
  console.log('Routes:', routes);
  console.log('RouteStations:', routeStations);
  console.log('Schedules:', schedules);
}
main()
  .catch((error) => {
    console.error('ERROR:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
