const axios = require('axios');

const PAYMONGO_API_URL = 'https://api.paymongo.com/v1';
const secretKey = process.env.PAYMONGO_SECRET_KEY;

function getAuthHeader() {
  const encoded = Buffer.from(`${secretKey}:`).toString('base64');
  return `Basic ${encoded}`;
}

async function createPaymentIntent(amount, description, metadata) {
  try {
    const response = await axios.post(
      `${PAYMONGO_API_URL}/payment_intents`,
      {
        data: {
          attributes: {
            amount: Math.round(amount * 100),
            payment_method_allowed: ['gcash', 'maya', 'grab_pay', 'card'],
            payment_method_options: {
              card: { request_three_d_secure: 'any' },
            },
            currency: 'PHP',
            description: description || 'Mamagan Beach Resort Booking',
            metadata: metadata || {},
          },
        },
      },
      {
        headers: {
          Authorization: getAuthHeader(),
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.data;
  } catch (err) {
    console.error('PayMongo create intent error:', err.response?.data || err.message);
    throw err;
  }
}

async function createPaymentMethod(type, details) {
  try {
    const data = {
      data: {
        attributes: {
          type,
          details,
        },
      },
    };

    const response = await axios.post(`${PAYMONGO_API_URL}/payment_methods`, data, {
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
      },
    });
    return response.data.data;
  } catch (err) {
    console.error('PayMongo create method error:', err.response?.data || err.message);
    throw err;
  }
}

async function attachPaymentMethod(intentId, methodId, clientKey) {
  try {
    const response = await axios.post(
      `${PAYMONGO_API_URL}/payment_intents/${intentId}/attach`,
      {
        data: {
          attributes: {
            payment_method: methodId,
            client_key: clientKey,
          },
        },
      },
      {
        headers: {
          Authorization: getAuthHeader(),
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.data;
  } catch (err) {
    console.error('PayMongo attach error:', err.response?.data || err.message);
    throw err;
  }
}

async function retrievePaymentIntent(intentId) {
  try {
    const response = await axios.get(`${PAYMONGO_API_URL}/payment_intents/${intentId}`, {
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
      },
    });
    return response.data.data;
  } catch (err) {
    console.error('PayMongo retrieve intent error:', err.response?.data || err.message);
    throw err;
  }
}

module.exports = {
  createPaymentIntent,
  createPaymentMethod,
  attachPaymentMethod,
  retrievePaymentIntent,
};

