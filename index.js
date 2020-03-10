const express = require('express');
var cors = require('cors');
const app = express();
const { resolve } = require('path');
// Copy the .env.example in the root into a .env file in this folder

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const get = require('lodash').get;
const adapter = new FileSync('db.json');
const db = low(adapter);
db.defaults({ users: [] }).write();

const env = require('dotenv').config({ path: './.env' });
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const config = {
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
};

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

const getCustomer = async email => {
  console.log('called');
  const user = db
    .get('users')
    .find({ email })
    .value();
  let customer = null;

  if (user) {
    customer = await stripe.customers.retrieve(user.customerId);
  } else {
    const customerReturned = await stripe.customers.create({
      email: email
    });
    // console.log(customerReturned);
    db.get('users')
      .push({ email, customerId: customerReturned.id })
      .write();
    customer = customerReturned;
  }
  return customer;
};

// Fetch the Checkout Session to display the JSON result on the success page
app.get('/checkout-session', async (req, res) => {
  const { sessionId } = req.query;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  res.send(session);
});

app.post('/retrieve-customer', async (req, res) => {
  try {
    const { email } = req.body;
    const user = db
      .get('users')
      .find({ email })
      .value();

    console.log(email, user);
    let customer = null;
    console.log(user);
    if (user) {
      customer = await stripe.customers.retrieve(user.customerId);
      console.log(customer);
    }
    res.json(customer);
  } catch (err) {
    return res.status(500).json({ error: err });
  }
});

app.post('/user-subscription', async (req, res) => {
  const { email } = req.body;

  const customer = await getCustomer(email);
  const currentSubscription = get(customer, 'subscriptions.data[0]');

  if (currentSubscription) {
    return res.json(currentSubscription);
  }
});

app.post('/create-subscription', async (req, res) => {
  const { email, planId } = req.body;

  const customer = await getCustomer(email);
  if (!customer)
    return res.status(500).json({ error: 'An error has occurred' });

  const currentSubscription = get(customer, 'subscriptions.data[0]');

  if (currentSubscription) {
    return res.status(400).json({
      error:
        'You already have an active subscription, cancel it to start another'
    });
  } else {
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ plan: planId }]
    });
    res.send(subscription);
  }
});

app.post('/cancel-subscription', async (req, res) => {
  const { email } = req.body;

  const customer = await getCustomer(email);
  const currentSubscription = get(customer, 'subscriptions.data[0]');

  if (
    currentSubscription &&
    !currentSubscription.cancel_at_period_end &&
    !currentSubscription.canceled_at
  ) {
    if (currentSubscription.plan.id === process.env.INDIVIDUAL_PLAN_ID) {
      stripe.subscriptions.del(currentSubscription.id);
    } else if (currentSubscription.plan.id === process.env.SPEAKER_PLAN_ID) {
      stripe.subscriptions.update(currentSubscription.id, {
        cancel_at_period_end: true
      });
    }

    return res.send({ currentSubscription });
  }

  return res
    .status(400)
    .json({ error: "You don't have a currently active subscription" });
});

app.post('/create-checkout-session', async (req, res) => {
  const domainURL = process.env.DOMAIN;
  const { planId, email } = req.body;

  const customer = await getCustomer(email);
  if (!customer)
    return res.status(500).json({ error: 'An error has occurred' });

  const hasSubscription = get(customer, 'subscriptions.data[0].id');

  if (hasSubscription) {
    return res.status(400).json({
      error:
        'You already have an active subscription, cancel it to start another'
    });
  } else {
    session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      subscription_data: { items: [{ plan: planId }] },
      // ?session_id={CHECKOUT_SESSION_ID} means the redirect will have the session ID set as a query param
      success_url: `${domainURL}/plans/success/{CHECKOUT_SESSION_ID}`,
      cancel_url: `${domainURL}/plans/cancel`
    });
  }

  console.log(
    planId,
    config.plans.find(plan => plan.id === planId)
  );

  res.send({
    sessionId: session.id,
    plan: config.plans.find(plan => plan.id === planId)
  });
});

const hasSubscription = (planId, customer) => {
  const planSubscriptions = customer.subscriptions.data.find(
    sub => sub.plan.id === planId
  );
  console.log(Boolean(planSubscriptions));
  return Boolean(planSubscriptions);
};

app.post('/setup', async (req, res) => {
  //   try {
  const { email } = req.body;
  const user = db
    .get('users')
    .find({ email })
    .value();

  console.log(email, user);
  let customer = null;
  console.log(user);
  if (user) {
    customer = await stripe.customers.retrieve(user.customerId);
    const newPlanData = config.plans.map(v => ({
      ...v,
      subscribed: hasSubscription(v.id, customer)
    }));
    res.send({ ...config, plans: newPlanData, customer });
  } else res.send({ ...config, customer });
  //   } catch (err) {
  //     return res.status(500).json({ error: err });
  //   }
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
