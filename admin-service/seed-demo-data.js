const prisma = require("./src/config/prisma");
const trainService = require("./src/services/train.service");
const scheduleService = require("./src/services/schedule.service");

const stations = {
  BGLR: "42c1838d-7ef5-4037-8b8b-e1e6c1133068",
  LKO: "test-lko-001",
  MMCT: "test-mmct-001",
  NDLS: "abd59543-0a7d-489d-8c6c-811536e929a1",
};

const trains = [
  ["88001", "Demo Deccan Express", ["BGLR", "MMCT", "NDLS"]],
  ["88002", "Demo Yamuna Express", ["LKO", "MMCT"]],
  ["88003", "Demo Ganga Express", ["BGLR", "MMCT", "NDLS"]],
  ["88004", "Demo Taj Express", ["MMCT", "NDLS", "LKO"]],
  ["88005", "Demo Rajdhani Express", ["BGLR", "LKO", "NDLS"]],
  ["88006", "Demo Shatabdi Express", ["MMCT", "NDLS"]],
  ["88007", "Demo Chambal Express", ["BGLR", "LKO", "NDLS"]],
  ["88008", "Demo Gomti Express", ["LKO", "MMCT", "NDLS"]],
  ["88009", "Demo Narmada Express", ["BGLR", "MMCT"]],
  ["88010", "Demo Vindhya Express", ["MMCT", "NDLS"]],
  ["88011", "Demo Krishna Express", ["BGLR", "LKO", "MMCT"]],
  ["88012", "Demo Kaveri Express", ["LKO", "NDLS"]],
  ["88013", "Demo Godavari Express", ["BGLR", "MMCT", "NDLS"]],
  ["88014", "Demo Saraswati Express", ["LKO", "MMCT", "NDLS"]],
  ["88015", "Demo Mahanadi Express", ["BGLR", "LKO", "NDLS"]],
  ["88016", "Demo Tapti Express", ["MMCT", "NDLS"]],
  ["88017", "Demo Betwa Express", ["BGLR", "LKO"]],
  ["88018", "Demo Son Express", ["LKO", "MMCT", "NDLS"]],
  ["88019", "Demo Brahmaputra Express", ["BGLR", "MMCT", "NDLS"]],
  ["88020", "Demo Mahanagari Express", ["MMCT", "NDLS"]],
  ["88021", "Demo Aravali Express", ["BGLR", "LKO"]],
  ["88022", "Demo Malwa Express", ["LKO", "NDLS"]],
  ["88023", "Demo Doon Express", ["BGLR", "MMCT", "NDLS"]],
  ["88024", "Demo Kalinga Express", ["MMCT", "NDLS"]],
  ["88025", "Demo Konkan Express", ["BGLR", "LKO", "MMCT"]],
  ["88026", "Demo Purva Express", ["LKO", "NDLS"]],
  ["88027", "Demo Magadh Express", ["BGLR", "MMCT", "NDLS"]],
  ["88028", "Demo Awadh Express", ["LKO", "MMCT", "NDLS"]],
  ["88029", "Demo Bundelkhand Express", ["BGLR", "LKO", "NDLS"]],
  ["88030", "Demo Rajya Rani Express", ["MMCT", "NDLS", "LKO"]],
];

const seats = [
  { seatNumber: 1, seatType: "LOWER", price: 500 },
  { seatNumber: 2, seatType: "MIDDLE", price: 500 },
  { seatNumber: 3, seatType: "UPPER", price: 500 },
  { seatNumber: 4, seatType: "LOWER", price: 550 },
  { seatNumber: 5, seatType: "MIDDLE", price: 550 },
  { seatNumber: 6, seatType: "UPPER", price: 550 },
  { seatNumber: 7, seatType: "SIDE_LOWER", price: 450 },
  { seatNumber: 8, seatType: "SIDE_UPPER", price: 450 },
  { seatNumber: 9, seatType: "LOWER", price: 600 },
  { seatNumber: 10, seatType: "UPPER", price: 600 },
];

function buildRoute(routeCodes) {
  return routeCodes.map((code, index) => ({
    stationId: stations[code],
    sequenceNumber: index + 1,
    arrivalTime:
      index === 0 ? null : `${String(6 + index * 4).padStart(2, "0")}:00`,
    departureTime:
      index === routeCodes.length - 1
        ? null
        : `${String(6 + index * 4).padStart(2, "0")}:10`,
    distanceFromOrigin: index * 350,
  }));
}

async function main() {
  console.log("==========================================");
  console.log("       IRCTC DEMO DATA SEEDER");
  console.log("==========================================");

  for (let i = 0; i < trains.length; i++) {
    const [trainNumber, trainName, routeCodes] = trains[i];

    console.log(
      `\n[${i + 1}/30] Creating ${trainNumber} - ${trainName}`
    );

    // 1. Create train
    const train = await trainService.createTrain({
      trainNumber,
      trainName,
      coachName: "AC",
      seats,
    });

    console.log(`  ✓ Train created: ${train.id}`);

    // 2. Create route
    const route = await trainService.createRoute({
      trainId: train.id,
      stations: buildRoute(routeCodes),
    });

    console.log(`  ✓ Route created: ${route.id}`);

    // 3. Create schedule
    const schedule = await scheduleService.createSchedule({
      trainId: train.id,
      departureDate: "2026-09-21",
    });

    console.log(`  ✓ Schedule created: ${schedule.id}`);

    // Give Kafka a little breathing room
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("\n==========================================");
  console.log("          SEEDING SUCCESSFUL");
  console.log("==========================================");
  console.log("Trains    : 30");
  console.log("Seats     : 300");
  console.log("Routes    : 30");
  console.log("Schedules : 30");
}

main()
  .catch((error) => {
    console.error("\n❌ SEEDING FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });