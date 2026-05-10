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
  remember: Joi.boolean().optional(),
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

  // category/size for filtering
  category: Joi.string().valid('cottage', 'room_cabana', 'beach_equipment').required(),
  size: Joi.string().valid('small', 'medium', 'large', 'extra_large').allow('', null),

  // legacy type kept so existing UI doesn’t break
  type: Joi.string().valid('cabana', 'day_bed', 'jet_ski', 'island_tour', 'day_bed', 'vest', 'boat', 'stand_paddle_boat').allow('', null),

  description: Joi.string().allow('', null),
  // Optional image link (local file uploads are handled separately via multer)
  images_link: Joi.string().uri().allow('', null),

  // legacy fields
  base_price: Joi.number().positive().allow(null),

  // new day range storage
  price_day_min: Joi.number().positive().allow(0).default(0),
  price_day_max: Joi.number().positive().allow(0).default(0),

  // night add-on rule
  night_add_threshold_pax: Joi.number().integer().min(1).default(6),
  night_add_value: Joi.number().positive().allow(0).default(0),
  night_add_value_high: Joi.number().positive().allow(0).default(0),

  // beach equipment rates
  hourly_rate: Joi.number().positive().allow(0).default(0),
  daily_rate: Joi.number().positive().allow(0).default(0),

  capacity: Joi.number().integer().min(1).default(1),
  total_units: Joi.number().integer().min(1).required(),

  allow_time_slots: Joi.boolean().default(true),

  is_active: Joi.boolean().optional(),
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

