const Joi = require('joi');

const registerSchema = Joi.object({
  full_name: Joi.string().min(2).max(255).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(255).required(),
  phone: Joi.string().max(50).allow('', null),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const bookingSchema = Joi.object({
  facility_id: Joi.string().uuid().required(),
  booking_date: Joi.date().iso().required(),
  time_slot: Joi.string().required(),
  quantity: Joi.number().integer().min(1).max(20).default(1),
  promo_code: Joi.string().allow('', null),
});

const facilitySchema = Joi.object({
  resort_id: Joi.string().uuid().required(),
  name: Joi.string().min(1).max(255).required(),
  type: Joi.string().valid('cabana', 'day_bed', 'jet_ski', 'island_tour').required(),
  description: Joi.string().allow('', null),
  base_price: Joi.number().positive().required(),
  capacity: Joi.number().integer().min(1).default(1),
  total_units: Joi.number().integer().min(1).required(),
});

const paymentIntentSchema = Joi.object({
  booking_id: Joi.string().uuid().required(),
  payment_method: Joi.string().valid('gcash', 'maya', 'grabpay', 'card').required(),
});

module.exports = {
  registerSchema,
  loginSchema,
  bookingSchema,
  facilitySchema,
  paymentIntentSchema,
};

