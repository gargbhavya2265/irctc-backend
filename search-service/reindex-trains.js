const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, "../admin-service/.env")
});

const prisma = require("../admin-service/src/config/prisma");

require("dotenv").config({
    path: path.join(__dirname, ".env")
});

const { Client } = require("@elastic/elasticsearch");

const esClient = new Client({
    node: process.env.ELASTICSEARCH_URL,
    auth: {
        apiKey: process.env.ELASTICSEARCH_API_KEY
    }
});

async function main() {
    console.log("REINDEX STARTED");

    // ==============================
    // FETCH DATA FROM POSTGRESQL
    // ==============================

    const stations = await prisma.station.findMany();

    const trains = await prisma.train.findMany({
        include: {
            seats: true,
            route: {
                include: {
                    routeStations: {
                        include: {
                            station: true
                        },
                        orderBy: {
                            sequenceNumber: "asc"
                        }
                    }
                }
            },
            schedules: true
        }
    });

    console.log("Stations from PostgreSQL:", stations.length);
    console.log("Trains from PostgreSQL:", trains.length);

    // ==============================
    // DELETE OLD STATIONS INDEX
    // ==============================

    console.log("Deleting stations index...");

    const stationsExists = await esClient.indices.exists({
        index: "stations"
    });

    if (stationsExists) {
        await esClient.indices.delete({
            index: "stations"
        });

        console.log("Stations index deleted.");
    } else {
        console.log("Stations index doesn't exist.");
    }

    // ==============================
    // DELETE OLD TRAINS INDEX
    // ==============================

    console.log("Deleting trains index...");

    const trainsExists = await esClient.indices.exists({
        index: "trains"
    });

    if (trainsExists) {
        await esClient.indices.delete({
            index: "trains"
        });

        console.log("Trains index deleted.");
    } else {
        console.log("Trains index doesn't exist.");
    }

    // ==============================
    // CREATE STATIONS INDEX
    // ==============================

    console.log("Creating stations index...");

    await esClient.indices.create({
        index: "stations",
        mappings: {
            properties: {
                stationId: {
                    type: "keyword"
                },
                name: {
                    type: "text"
                },
                code: {
                    type: "keyword"
                },
                city: {
                    type: "text"
                },
                suggest: {
                    type: "completion"
                }
            }
        }
    });

    console.log("Stations index created.");

    // ==============================
    // CREATE TRAINS INDEX
    // ==============================

    console.log("Creating trains index...");

    await esClient.indices.create({
        index: "trains",
        mappings: {
            properties: {
                trainId: {
                    type: "keyword"
                },

                trainNumber: {
                    type: "keyword"
                },

                trainName: {
                    type: "text"
                },

                route: {
                    type: "nested",
                    properties: {
                        stationId: {
                            type: "keyword"
                        },

                        stationName: {
                            type: "text"
                        },

                        stationCode: {
                            type: "keyword"
                        },

                        sequenceNumber: {
                            type: "integer"
                        },

                        arrivalTime: {
                            type: "keyword"
                        },

                        departureTime: {
                            type: "keyword"
                        },

                        distanceFromOrigin: {
                            type: "float"
                        }
                    }
                },

                schedules: {
                    type: "nested",
                    properties: {
                        scheduleId: {
                            type: "keyword"
                        },

                        departureDate: {
                            type: "date"
                        },

                        status: {
                            type: "keyword"
                        }
                    }
                },

                seatSummary: {
                    properties: {
                        total: {
                            type: "integer"
                        },

                        LOWER: {
                            type: "integer"
                        },

                        MIDDLE: {
                            type: "integer"
                        },

                        UPPER: {
                            type: "integer"
                        },

                        SIDE_LOWER: {
                            type: "integer"
                        },

                        SIDE_UPPER: {
                            type: "integer"
                        }
                    }
                }
            }
        }
    });

    console.log("Trains index created.");

    // ==============================
    // INDEX STATIONS
    // ==============================

    console.log("Indexing stations...");

    for (const station of stations) {
        await esClient.index({
            index: "stations",
            id: station.id,
            document: {
                stationId: station.id,
                name: station.name,
                code: station.code,
                city: station.city,

                suggest: {
                    input: [
                        station.name,
                        station.code,
                        station.city
                    ],
                    weight: 10
                }
            }
        });
    }

    console.log("Stations indexed:", stations.length);

    // ==============================
    // INDEX TRAINS
    // ==============================

    console.log("Indexing trains...");

    for (const train of trains) {
        // ------------------------------
        // SEAT SUMMARY
        // ------------------------------

        const seatSummary = {
            total: train.seats.length,
            LOWER: 0,
            MIDDLE: 0,
            UPPER: 0,
            SIDE_LOWER: 0,
            SIDE_UPPER: 0
        };

        for (const seat of train.seats) {
            if (seatSummary[seat.seatType] !== undefined) {
                seatSummary[seat.seatType]++;
            }
        }

        // ------------------------------
        // ROUTE
        // ------------------------------

        const route = train.route
            ? train.route.routeStations.map((rs) => ({
                stationId: rs.station.id,
                stationName: rs.station.name,
                stationCode: rs.station.code,
                sequenceNumber: rs.sequenceNumber,
                arrivalTime: rs.arrivalTime,
                departureTime: rs.departureTime,
                distanceFromOrigin: rs.distanceFromOrigin
            }))
            : [];

        // ------------------------------
        // SCHEDULES
        // ------------------------------

        const schedules = train.schedules.map((schedule) => ({
            scheduleId: schedule.id,
            departureDate: schedule.departureDate,
            status: schedule.status
        }));

        // ------------------------------
        // INDEX TRAIN
        // ------------------------------

        await esClient.index({
            index: "trains",
            id: train.id,
            document: {
                trainId: train.id,
                trainNumber: train.trainNumber,
                trainName: train.trainName,
                route,
                schedules,
                seatSummary
            }
        });
    }

    console.log("Trains indexed:", trains.length);

    // ==============================
    // REFRESH INDICES
    // ==============================

    console.log("Refreshing Elasticsearch indices...");

    await esClient.indices.refresh({
        index: ["stations", "trains"]
    });

    // ==============================
    // VERIFY COUNTS
    // ==============================

    const stationCount = await esClient.count({
        index: "stations"
    });

    const trainCount = await esClient.count({
        index: "trains"
    });

    console.log(
        "Elasticsearch stations:",
        stationCount.count
    );

    console.log(
        "Elasticsearch trains:",
        trainCount.count
    );

    // ==============================
    // SUCCESS
    // ==============================

    console.log("REINDEX SUCCESSFUL");

    await prisma.$disconnect();
}

// ==============================
// ERROR HANDLING
// ==============================

main().catch(async (error) => {
    console.error("REINDEX FAILED");
    console.error(error);

    await prisma.$disconnect();

    process.exit(1);
});