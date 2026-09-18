const express = require('express');

const { requireAuth } = require('../middlewares/auth.middleware');

const {
    createProxy,
    getCircuitBreakerStatus
} = require('../services/proxy');

const {
    ipRateLimit,
    userRateLimit,
    endpointRateLimit
} = require('../middlewares/rateLimiting.middleware');

const { config } = require('../config');

const router = express.Router();

// ===========================
// Service Proxy Routes
// ===========================

/**
 * USER SERVICE ROUTES
 */

const userServiceProxy = createProxy(
    'userService',
    config.SERVICES.USER_SERVICE_URL
);

// ===========================
// PUBLIC USER ROUTES
// ===========================

router.post(
    '/users/auth/send-otp',
    endpointRateLimit(5, 3600000),
    userServiceProxy
);

router.post(
    '/users/auth/verify-otp',
    endpointRateLimit(10, 3600000),
    userServiceProxy
);

router.post(
    '/users/auth/login',
    endpointRateLimit(100, 900000),
    userServiceProxy
);

router.post(
    '/users/auth/google-auth',
    endpointRateLimit(10, 900000),
    userServiceProxy
);

router.post(
    '/users/auth/refresh',
    endpointRateLimit(20, 900000),
    userServiceProxy
);

// ===========================
// PRIVATE USER ROUTES
// ===========================

router.get(
    '/users/user/profile',
    ipRateLimit(),
    requireAuth,
    userRateLimit(),
    userServiceProxy
);

router.put(
    '/users/user/profile',
    ipRateLimit(),
    requireAuth,
    userRateLimit(),
    userServiceProxy
);

router.delete(
    '/users/user/profile',
    ipRateLimit(),
    requireAuth,
    userRateLimit(),
    userServiceProxy
);

// ===========================
// ADMIN SERVICE ROUTES
// ===========================

const adminServiceProxy = createProxy(
    'adminService',
    config.SERVICES.ADMIN_SERVICE_URL
);

// ---------- Stations ----------

router.post(
    '/admins/stations/station',
    ipRateLimit(),
    requireAuth,
    userRateLimit(),
    adminServiceProxy
);

router.get(
    '/admins/stations/station',
    ipRateLimit(),
    requireAuth,
    userRateLimit(),
    adminServiceProxy
);

router.post(
    '/admins/stations/station/reindex',
    ipRateLimit(),
    requireAuth,
    userRateLimit(),
    adminServiceProxy
);

// ---------- Trains ----------

router.post(
    '/admins/trains/train',
    ipRateLimit(),
    requireAuth,
    userRateLimit(),
    adminServiceProxy
);

router.get(
    '/admins/trains/train',
    ipRateLimit(),
    requireAuth,
    userRateLimit(),
    adminServiceProxy
);

router.get(
    '/admins/trains/train/:trainId',
    ipRateLimit(),
    requireAuth,
    userRateLimit(),
    adminServiceProxy
);

// ---------- Routes ----------

router.post(
    '/admins/trains/route',
    ipRateLimit(),
    requireAuth,
    userRateLimit(),
    adminServiceProxy
);

// ---------- Schedules ----------

router.post(
    '/admins/schedules/schedule',
    ipRateLimit(),
    requireAuth,
    userRateLimit(),
    adminServiceProxy
);

router.get(
    '/admins/schedules/schedule',
    ipRateLimit(),
    requireAuth,
    userRateLimit(),
    adminServiceProxy
);

router.put(
    '/admins/schedules/schedule/:scheduleId',
    ipRateLimit(),
    requireAuth,
    userRateLimit(),
    adminServiceProxy
);

// ===========================
// SEARCH SERVICE ROUTES
// Public - No Auth Required
// ===========================

const searchServiceProxy = createProxy(
    'searchService',
    config.SERVICES.SEARCH_SERVICE_URL
);

router.get(
    '/search/trains',
    endpointRateLimit(60, 60000),
    searchServiceProxy
);

router.get(
    '/search/trains/all',
    endpointRateLimit(60, 60000),
    searchServiceProxy
);

router.get(
    '/search/autocomplete',
    endpointRateLimit(120, 60000),
    searchServiceProxy
);

// ===========================
// INVENTORY SERVICE ROUTES
// ===========================

const inventoryServiceProxy = createProxy(
    'inventoryService',
    config.SERVICES.INVENTORY_SERVICE_URL
);

// Public availability

router.get(
    '/inventory/schedules/:scheduleId/availability',
    endpointRateLimit(120, 60000),
    inventoryServiceProxy
);

// Authenticated seat statuses

router.get(
    '/inventory/schedules/:scheduleId/seats',
    ipRateLimit(),
    requireAuth,
    userRateLimit(),
    inventoryServiceProxy
);

// ===========================
// BOOKING SERVICE ROUTES
// ===========================

const bookingServiceProxy = createProxy(
    'bookingService',
    config.SERVICES.BOOKING_SERVICE_URL
);

// Booking attempts

router.post(
    '/bookings/bookings',
    ipRateLimit(),
    requireAuth,
    userRateLimit({ max: 5, windowMs: 60000 }),
    bookingServiceProxy
);

router.get(
    '/bookings/bookings',
    ipRateLimit(),
    requireAuth,
    userRateLimit(),
    bookingServiceProxy
);

router.get(
    '/bookings/bookings/:bookingId',
    ipRateLimit(),
    requireAuth,
    userRateLimit(),
    bookingServiceProxy
);

router.post(
    '/bookings/bookings/:bookingId/verify-payment',
    ipRateLimit(),
    requireAuth,
    userRateLimit(),
    bookingServiceProxy
);

router.post(
    '/bookings/bookings/:bookingId/cancel',
    ipRateLimit(),
    requireAuth,
    userRateLimit(),
    bookingServiceProxy
);

// ===========================
// PAYMENT SERVICE ROUTES
// ===========================

const paymentServiceProxy = createProxy(
    'paymentService',
    config.SERVICES.PAYMENT_SERVICE_URL
);

// Razorpay webhook

router.post(
    '/payments/webhooks/razorpay',
    paymentServiceProxy
);

// ===========================
// GATEWAY HEALTH
// ===========================

router.get('/gateway/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'API Gateway is healthy',
        timestamp: new Date().toISOString()
    });
});

router.get('/gateway/circuit-breakers', (req, res) => {
    const status = getCircuitBreakerStatus();

    res.status(200).json({
        success: true,
        circuitBreakers: status
    });
});

module.exports = router;