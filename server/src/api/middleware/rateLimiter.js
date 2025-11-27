/**
 * Rate Limiting Middleware
 * Protects routes from DoS attacks by limiting request frequency
 */

const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter
 * Applies to most authenticated endpoints
 * 100 requests per 15 minutes
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
});

/**
 * Strict rate limiter for public endpoints
 * Applies to unauthenticated endpoints that perform expensive operations
 * 30 requests per 15 minutes
 */
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Max 30 requests per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Very strict rate limiter for write operations
 * Applies to data creation/modification endpoints
 * 50 requests per 15 minutes
 */
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Max 50 requests per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'Too many write operations. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Lenient rate limiter for sensor data submissions
 * Allows higher frequency for IoT device data uploads
 * 500 requests per 15 minutes
 */
const sensorDataLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Max 500 requests per windowMs (allows ~33 per minute)
  message: {
    error: 'Too Many Requests',
    message: 'Sensor data submission rate exceeded. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  publicLimiter,
  writeLimiter,
  sensorDataLimiter,
};
