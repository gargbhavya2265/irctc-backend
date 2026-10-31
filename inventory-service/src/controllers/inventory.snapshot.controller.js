const asyncHandler = require('../utils/asyncHandler');
const snapshotService = require('../services/inventory.snapshot.service');

exports.getSchedulesSnapshot = asyncHandler(async (req, res) => {
     const data = await snapshotService.getSchedulesSnapshot();

     return res.status(200).json({
          success: true,
          message: 'Inventory schedules snapshot fetched successfully',
          data,
     });
});