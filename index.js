const express = require('express');
var cors = require('cors');
const app = express();
const { resolve } = require('path');
// Copy the .env.example in the root into a .env file in this folder

const env = require('dotenv').config({ path: './.env' });
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.use(cors());

// app.use(express.static(process.env.STATIC_DIR));
app.use(
  express.json({
    // We need the raw body to verify webhook signatures.
    // Let's compute it only when hitting the Stripe webhook endpoint.
    verify: function(req, res, buf) {
      if (req.originalUrl.startsWith('/webhook')) {
        req.rawBody = buf.toString();
      }
    }
  })
);

// app.get('/', (req, res) => {
//   const path = resolve(process.env.STATIC_DIR + '/index.html');
//   res.sendFile(path);
// });

// Fetch the Checkout Session to display the JSON result on the success page
app.get('/checkout-session', async (req, res) => {
  const { sessionId } = req.query;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  res.send(session);
});

app.post('/create-checkout-session', async (req, res) => {
  const domainURL = process.env.DOMAIN;
  const { planId } = req.body;

  // Create new Checkout Session for the order
  // Other optional params include:
  // [billing_address_collection] - to display billing address details on the page
  // [customer] - if you have an existing Stripe Customer ID
  // [customer_email] - lets you prefill the email input in the form
  // For full details see https://stripe.com/docs/api/checkout/sessions/create
  session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    subscription_data: { items: [{ plan: planId }] },
    // ?session_id={CHECKOUT_SESSION_ID} means the redirect will have the session ID set as a query param
    success_url: `${domainURL}/plans/success/{CHECKOUT_SESSION_ID}`,
    cancel_url: `${domainURL}/plans/cancel`
  });

  res.send({
    sessionId: session.id
  });
});

app.get('/setup', (req, res) => {
  res.send({
    publicKey: process.env.STRIPE_PUBLISHABLE_KEY,
    plans: [
      {
        id: process.env.INDIVIDUAL_PLAN_ID,
        plan: 'INDIVIDUAL',
        price: 'FREE',
        frequency: '',
        description: 'Ad Supported',
        validFor: 'Unlimited',
        title: 'Individual Access'
      },
      {
        id: process.env.SPEAKER_PLAN_ID,
        plan: 'SPEAKER',
        price: '9.99',
        frequency: 'monthly',
        description: 'Great for speakers and Entrepreneurs',
        validFor: '12 months',
        title: 'Speaker Membership',
        bestValue: true
      },
      {
        id: process.env.CORPORATE_PLAN_ID,
        plan: 'CORPORATE',
        price: '',
        priceSubCaption: 'Please contact us for pricing',
        frequency: '',
        description: 'Great for large groups',
        validFor: '12 months',
        title: 'For up to 10 end-users'
      }
    ]
  });
});

// Webhook handler for asynchronous events.
app.post('/webhook', async (req, res) => {
  let eventType;
  // Check if webhook signing is configured.
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event;
    let signature = req.headers['stripe-signature'];

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed.`);
      return res.sendStatus(400);
    }
    // Extract the object from the event.
    data = event.data;
    eventType = event.type;
  } else {
    // Webhook signing is recommended, but if the secret is not configured in `config.js`,
    // retrieve the event data directly from the request body.
    data = req.body.data;
    eventType = req.body.type;
  }

  if (eventType === 'checkout.session.completed') {
    console.log(`🔔  Payment received!`);
  }

  res.sendStatus(200);
});

app.listen(4242, () => console.log(`Node server listening on port ${4242}!`));
