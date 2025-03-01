## Helping Hand
Go Fund Me on the blockchain, but better.

### Humanity Protocol Integration
On Helping Hand, anyone with a wallet can donate. However, only verified users can Ask for Help (create a fundraiser). To get verified, a user must provide a Verifiable Credential (VC). The application calls Humanity's API to validate the VC. If the user has no VC, the application directs them to where they can get one. In the future, we expect this to become more frictionless as more features and providers join the protocol.

### The Helping Hand Team
**Manok** - (Founder) Manok has a background in Java applications development and support. He's been dabbling in crypto since 2014. His focus now is to build and work on interesting projects in the space.

**Aidan** - (Founder) Loves long walks and sunsets.

**Roman** - (Founder) His favorite color is Violet.

**Dylan** - (Founder) Can eat six tacos in one sitting.

### Testing Instructions
#### Download
```shell
$ git clone https://github.com/manokdlp3/helping-hand-ui.git
```

#### Install Dependencies
```shell
$ npm install
```
#### Update `.env.local`
`NEXT_PUBLIC_API_KEY=` Enter your Humanity API Key in the env file.

#### Run
```shell
$ npm run dev
```
On a web browser, navigate to `localhost:3000`. Click **Ask for Help**. If you're not verified yet, the application will ask you to verify. Click **Verify**. Upload your VC file. A sample file can be foound in `./src/pages/vc.json`. The application will call the Humanity API to verify the VC. Once verified, you can now create a fundraiser (Ask For Help). You do not need to be verified to donate.

### Our Experience Building on Humanity
Integrating with Humanity is pretty straightforward. Requesting for an API key was easy and Humanity was quick to provide us one. There are features that we wish were available. Perhaps they will be, in future versions of the protocol. 
