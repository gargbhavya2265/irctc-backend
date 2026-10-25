const { esClient, TRAIN_INDEX, STATION_INDEX } = require('../config/elasticsearch');
const logger = require('../config/logger');

const getResponseBody = (response) => response?.body ?? response;
const search = async (params) => getResponseBody(await esClient.search(params));

// ---------------------------------------------------
// INDEX OPERATIONS (called by Kafka consumer)
// ---------------------------------------------------

/**
 * When admin creates a station, index it for autocomplete.
 */
const indexStation = async (station) => {
     if (!station) return;

     try {
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
                         input: [
                              station.name,
                              station.code,
                              station.city,
                              station.state,
                         ].filter(Boolean),
                         weight: 10,
                    },
               },
               refresh: true,
          });

          logger.info(`Indexed station ${station.name} (${station.code})`);
     } catch (err) {
          logger.error(`Failed to index station: ${err.message}`);
     }
};

/**
 * Index train route and its stations.
 */
const indexTrainRoute = async (routeEvent) => {
     if (!routeEvent) return;

     const { train, routeStations } = routeEvent;
     if (!train || !Array.isArray(routeStations)) return;

     const seatSummary = {
          total: 0,
          LOWER: 0,
          MIDDLE: 0,
          UPPER: 0,
          SIDE_LOWER: 0,
          SIDE_UPPER: 0,
     };

     (train.seats || []).forEach((seat) => {
          seatSummary.total++;
          if (seatSummary[seat.seatType] !== undefined) {
               seatSummary[seat.seatType]++;
          }
     });

     const doc = {
          trainId: train.id,
          trainNumber: train.trainNumber,
          trainName: train.trainName,
          route: routeStations.map((rs) => ({
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

     try {
          await esClient.index({
               index: TRAIN_INDEX,
               id: train.id,
               document: doc,
               refresh: true,
          });

          // Also index/update stations for autocomplete.
          for (const rs of routeStations) {
               if (!rs.station) continue;

               await esClient.index({
                    index: STATION_INDEX,
                    id: rs.station.id,
                    document: {
                         stationId: rs.station.id,
                         name: rs.station.name,
                         code: rs.station.code,
                         city: rs.station.city,
                         state: rs.station.state,
                         suggest: {
                              input: [
                                   rs.station.name,
                                   rs.station.code,
                                   rs.station.city,
                                   rs.station.state,
                              ].filter(Boolean),
                              weight: 10,
                         },
                    },
                    refresh: true,
               });
          }

          logger.info(
               `Indexed train ${train.trainNumber} with ${routeStations.length} stations`
          );
     } catch (err) {
          logger.error(`Failed to index train route: ${err.message}`);
          throw err;
     }
};

/**
 * Add schedule to the train's schedules array.
 */
const indexSchedule = async (scheduleEvent) => {
     const { scheduleId, trainId, departureDate, status, seats } = scheduleEvent;

     const totalSeats = seats ? seats.length : 0;

     try {
          await esClient.update({
               index: TRAIN_INDEX,
               id: trainId,
               script: {
                    source: `
                         if (ctx._source.schedules == null) {
                              ctx._source.schedules = [];
                         }
                         ctx._source.schedules.removeIf(
                              s -> s.scheduleId == params.scheduleId
                         );
                         ctx._source.schedules.add(params.newSchedule);
                    `,
                    params: {
                         scheduleId,
                         newSchedule: {
                              scheduleId,
                              departureDate,
                              status,
                              available: totalSeats,
                              locked: 0,
                              booked: 0,
                         },
                    },
               },
               refresh: true,
          });

          logger.info(`Indexed schedule ${scheduleId} for train ${trainId}`);
     } catch (err) {
          logger.warn(
               `Could not index schedule for train ${trainId}: ${err.message}`
          );
     }
};

/**
 * Update cancelled schedule status.
 */
const cancelSchedule = async (event) => {
     const schedule = event.data;
     if (!schedule) return;

     try {
          await esClient.update({
               index: TRAIN_INDEX,
               id: schedule.trainId,
               script: {
                    source: `
                         if (ctx._source.schedules != null) {
                              for (def s : ctx._source.schedules) {
                                   if (s.scheduleId == params.scheduleId) {
                                        s.status = 'CANCELLED';
                                   }
                              }
                         }
                    `,
                    params: {
                         scheduleId: schedule.id,
                    },
               },
               refresh: true,
          });

          logger.info(
               `Cancelled schedule ${schedule.id} for train ${schedule.trainId}`
          );
     } catch (err) {
          logger.warn(`Could not cancel schedule: ${err.message}`);
     }
};

/**
 * Update seat availability.
 */
const updateSeatAvailability = async (event) => {
     const { scheduleId, trainId, available, locked, booked } = event;

     try {
          await esClient.update({
               index: TRAIN_INDEX,
               id: trainId,
               script: {
                    source: `
                         if (ctx._source.schedules != null) {
                              for (def s : ctx._source.schedules) {
                                   if (s.scheduleId == params.scheduleId) {
                                        s.available = params.available;
                                        s.locked = params.locked;
                                        s.booked = params.booked;
                                   }
                              }
                         }
                    `,
                    params: {
                         scheduleId,
                         available: available ?? 0,
                         locked: locked ?? 0,
                         booked: booked ?? 0,
                    },
               },
               refresh: true,
          });

          logger.info(`Updated availability for schedule ${scheduleId}`);
     } catch (err) {
          logger.warn(
               `Could not update availability for schedule ${scheduleId}: ${err.message}`
          );
     }
};

// ---------------------------------------------------
// SEARCH OPERATIONS (called by API)
// ---------------------------------------------------

/**
 * Search trains running between two stations.
 */
const searchTrains = async (from, to, date) => {
     const fromStation = await resolveStation(from);
     const toStation = await resolveStation(to);

     if (!fromStation) {
          return { trains: [], message: `Station "${from}" not found` };
     }

     if (!toStation) {
          return { trains: [], message: `Station "${to}" not found` };
     }

     const query = {
          bool: {
               must: [
                    {
                         nested: {
                              path: 'route',
                              query: {
                                   term: {
                                        'route.stationId': fromStation.stationId,
                                   },
                              },
                              inner_hits: {
                                   name: 'from_station',
                              },
                         },
                    },
                    {
                         nested: {
                              path: 'route',
                              query: {
                                   term: {
                                        'route.stationId': toStation.stationId,
                                   },
                              },
                              inner_hits: {
                                   name: 'to_station',
                              },
                         },
                    },
               ],
          },
     };

     const result = await search({
          index: TRAIN_INDEX,
          body: {
               query,
               size: 50,
          },
     });

     const normalize = (value) => new Date(value).toISOString().slice(0, 10);

     const trains = result.hits.hits
          .map((hit) => {
               const src = hit._source;
               const fromHit = hit.inner_hits?.from_station?.hits?.hits?.[0]?._source;
               const toHit = hit.inner_hits?.to_station?.hits?.hits?.[0]?._source;

               if (
                    !fromHit ||
                    !toHit ||
                    fromHit.sequenceNumber >= toHit.sequenceNumber
               ) {
                    return null;
               }

               let scheduleInfo = null;

               if (date && src.schedules?.length > 0) {
                    scheduleInfo =
                         src.schedules.find(
                              (schedule) =>
                                   schedule.status === 'ACTIVE' &&
                                   normalize(schedule.departureDate) === date
                         ) || null;
               }

               return {
                    trainId: src.trainId,
                    trainNumber: src.trainNumber,
                    trainName: src.trainName,
                    from: {
                         name: fromHit.stationName,
                         code: fromHit.stationCode,
                         departure: fromHit.departureTime,
                         stationId: fromHit.stationId,
                         sequenceNumber: fromHit.sequenceNumber,
                    },
                    to: {
                         name: toHit.stationName,
                         code: toHit.stationCode,
                         arrival: toHit.arrivalTime,
                         stationId: toHit.stationId,
                         sequenceNumber: toHit.sequenceNumber,
                    },
                    seatSummary: src.seatSummary,
                    schedule: scheduleInfo,
               };
          })
          .filter(Boolean);

     return {
          from: {
               resolved: fromStation.name,
               code: fromStation.code,
          },
          to: {
               resolved: toStation.name,
               code: toStation.code,
          },
          date: date || 'any',
          count: trains.length,
          trains,
     };
};

/**
 * Resolve station by exact code, completion suggester, then fuzzy match.
 */
const resolveStation = async (input) => {
     if (!input || typeof input !== 'string') return null;

     // 1. Exact station code.
     const exactResult = await search({
          index: STATION_INDEX,
          body: {
               query: {
                    term: {
                         code: input.trim().toUpperCase(),
                    },
               },
               size: 1,
          },
     });

     if (exactResult.hits.hits.length > 0) {
          return exactResult.hits.hits[0]._source;
     }

     // 2. Completion suggester.
     try {
          const suggestResult = await search({
               index: STATION_INDEX,
               body: {
                    suggest: {
                         station_suggest: {
                              prefix: input.trim(),
                              completion: {
                                   field: 'suggest',
                                   fuzzy: {
                                        fuzziness: 'AUTO',
                                   },
                                   size: 1,
                              },
                         },
                    },
               },
          });

          const options =
               suggestResult.suggest?.station_suggest?.[0]?.options || [];

          if (options.length > 0) {
               return options[0]._source;
          }
     } catch (err) {
          logger.warn(`Suggest fallback failed: ${err.message}`);
     }

     // 3. Fuzzy match on station name/city.
     const fuzzyResult = await search({
          index: STATION_INDEX,
          body: {
               query: {
                    multi_match: {
                         query: input.trim(),
                         fields: ['name', 'city'],
                         fuzziness: 'AUTO',
                         prefix_length: 1,
                    },
               },
               size: 1,
          },
     });

     return fuzzyResult.hits.hits.length > 0
          ? fuzzyResult.hits.hits[0]._source
          : null;
};

/**
 * Autocomplete station names as user types.
 */
const autocompleteStation = async (prefix) => {
     if (!prefix || typeof prefix !== 'string' || !prefix.trim()) {
          return [];
     }

     try {
          const result = await search({
               index: STATION_INDEX,
               body: {
                    suggest: {
                         station_suggest: {
                              prefix: prefix.trim(),
                              completion: {
                                   field: 'suggest',
                                   skip_duplicates: true,
                                   size: 10,
                              },
                         },
                    },
               },
          });

          const options =
               result.suggest?.station_suggest?.[0]?.options || [];

          return options.map((option) => ({
               name: option._source.name,
               code: option._source.code,
               stationId: option._source.stationId,
          }));
     } catch (err) {
          logger.error(`Station autocomplete failed: ${err.message}`);
          throw err;
     }
};

/**
 * Get all indexed stations.
 */
const getAllStations = async () => {
     const result = await search({
          index: STATION_INDEX,
          body: {
               query: {
                    match_all: {},
               },
               size: 100,
          },
     });

     return result.hits.hits.map((hit) => hit._source);
};

/**
 * Get all indexed trains.
 */
const getAllTrains = async () => {
     const result = await search({
          index: TRAIN_INDEX,
          body: {
               query: {
                    match_all: {},
               },
               size: 100,
          },
     });

     return result.hits.hits.map((hit) => hit._source);
};

module.exports = {
     indexStation,
     indexTrainRoute,
     indexSchedule,
     cancelSchedule,
     updateSeatAvailability,
     searchTrains,
     autocompleteStation,
     getAllStations,
     getAllTrains,
};
