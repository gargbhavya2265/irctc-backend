const prisma = require('./src/config/prisma');
const { Client } = require('@elastic/elasticsearch'); const esClient = new Client({ node: 'http://elasticsearch:9200' }); const TRAIN_INDEX = 'trains'; const STATION_INDEX = 'stations';

async function main() {
     console.log('REINDEX STARTED');

     const stations = await prisma.station.findMany();

     for (const station of stations) {
          await esClient.index({
               index: STATION_INDEX,
               id: station.id,
               document: {
                    stationId: station.id,
                    name: station.name,
                    code: station.code,
                    city: station.city,
                    state: station.state,
                    suggest: {
                         input: [station.name, station.code, station.city, station.state].filter(Boolean),
                         weight: 10,
                    },
               },
               refresh: true,
          });
          console.log(`Station indexed: ${station.name}`);
     }

     const trains = await prisma.train.findMany({
          include: {
               seats: true,
               route: {
                    include: {
                         routeStations: {
                              include: {
                                   station: true,
                              },
                              orderBy: {
                                   sequenceNumber: 'asc',
                              },
                         },
                    },
               },
          },
     });

     for (const train of trains) {
          if (!train.route || !train.route.routeStations.length) {
               console.log(`Skipped train ${train.trainNumber}: route missing`);
               continue;
          }

          const seatSummary = {
               total: 0,
               LOWER: 0,
               MIDDLE: 0,
               UPPER: 0,
               SIDE_LOWER: 0,
               SIDE_UPPER: 0,
          };

          for (const seat of train.seats) {
               seatSummary.total++;
               if (seatSummary[seat.seatType] !== undefined) {
                    seatSummary[seat.seatType]++;
               }
          }

          const document = {
               trainId: train.id,
               trainNumber: train.trainNumber,
               trainName: train.trainName,
               route: train.route.routeStations.map((rs) => ({
                    stationId: rs.station.id,
                    stationName: rs.station.name,
                    stationCode: rs.station.code,
                    sequenceNumber: rs.sequenceNumber,
                    arrivalTime: rs.arrivalTime,
                    departureTime: rs.departureTime,
                    distanceFromOrigin: rs.distanceFromOrigin,
               })),
               schedules: [],
               seatSummary,
          };

          await esClient.index({
               index: TRAIN_INDEX,
               id: train.id,
               document,
               refresh: true,
          });

          console.log(`Train indexed: ${train.trainNumber} - ${train.trainName}`);
     }

     console.log(`DONE: ${stations.length} stations, ${trains.length} trains checked`);
}

main()
     .catch((err) => {
          console.error('REINDEX FAILED:', err.message);
          process.exitCode = 1;
     })
     .finally(async () => {
          await prisma.$disconnect();
     });
