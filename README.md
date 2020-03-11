# stripe-simple-server

Example server for stripe integration

```
yarn
yarn start
```

hosted at ```http://localhost:4242```



### Mutations and queries needed:

- Get Available Plans:

	Query to return plans, and user customer info

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
	customer: {
		// get the customerId from the database and retrieve info from stripe API
		// If a customer doesn't exist, create a customer on stripe and
		// save the customerID to the database
	}



- Create Subscription Mutation (for the individual plan, because it's free, it doesn't need payment info)

	Should reach the stripe API and create a new subscription

- Create Subscription Session  (for the speaker plan)

	Create a subscription checkout session with the plan id, to allow the front-end to redirect to stripe checkout

- Cancel a subscription

	Mutation to cancel subscription. Probably should immediatly delete the subscription if it's an individual plan, and set "cancel_at_end_of_period" to true if it's a paid plan. 

- Retrieve user subscription
	
	Get the customer active subscription details, billing period, status, etc.

- Contact Mutation
	
	Mutation to submit the contact form
