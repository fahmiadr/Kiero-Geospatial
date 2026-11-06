# Third-Party Iframe Integration Guide

This guide provides a comprehensive walkthrough for third-party websites to securely embed and interact with the map iframe. The integration is designed to be secure and robust, utilizing a token-based authentication flow (OAuth 2.0 JWT Bearer Grant) to ensure that only registered and trusted clients can access the service.

## Integration Flow Overview

The integration process involves a clear division of responsibilities between the third-party developer and the system administrator.

1.  **Third-Party:** You will generate a secure RSA key pair. The public key will be shared with the system administrator, while the private key will be kept secret on your backend.
2.  **System Admin:** Using your public key and website origin, the administrator will register your application as a trusted client in the system, providing you with a unique `Client ID`.
3.  **Third-Party:** On your backend, you will use your private key and the `Client ID` to generate a short-lived JSON Web Token (JWT) Assertion.
4.  **Third-Party:** On your frontend, you will render the iframe and pass the JWT Assertion to it. The iframe will use this assertion to authenticate itself and obtain an access token, enabling it to perform actions on your behalf.

---

## Generating an RSA Key Pair

First, you need to generate an `RS256` RSA key pair. This can be done using standard tools like `openssl`.

```bash
# Generate a 2048-bit private key
openssl genrsa -out private_key.pem 2048

# Extract the public key from the private key
openssl rsa -in private_key.pem -pubout -out public_key.pem
```

-   `private_key.pem`: **Keep this file secure on your backend.** It will be used to sign JWTs.
-   `public_key.pem`: Share the content of this file with the system administrator.

---

## Client Registration

Once you have your key pair, you must be registered as a client by the system administrator. You will need to provide:

1.  **Client Name:** A human-readable name for your application (e.g., "My Awesome App").
2.  **Allowed Origins:** The full origin URL of the website where the iframe will be embedded (e.g., `https://www.yourapp.com`). This is a security measure to prevent unauthorized domains from using your integration.
3.  **Public Key:** The complete content of your `public_key.pem` file.

The administrator will then use an internal script to register you and will provide you with a **`Client ID`** (e.g., `_Abc123DefGHIjklMnoPqR_`). Store this `Client ID` securely; you will need it for the next step.

---

## Backend Implementation: Generating the JWT Assertion

Your backend is responsible for creating a **JWT Assertion**. This token proves that a request is coming from you. The assertion must be generated and signed with your **private key**.

**JWT Payload Requirements:**

-   `iss` (Issuer): Your **`Client ID`**.
-   `sub` (Subject): Your **`Client ID`**.
-   `aud` (Audience): The token endpoint URL of the authentication server. The system admin will provide this, but it is typically `http://localhost:4000/oauth/token`.
-   `jti` (JWT ID): A unique random string for each token.
-   `exp` (Expiration Time): A short expiration time, typically **2-5 minutes** from the time of creation.

Here is an example of how to create this JWT in Node.js using the `jose` library:

```javascript
import * as jose from 'jose';
import fs from 'fs';
import { randomUUID } from 'crypto';

async function createJwtAssertion(privateKeyPath, clientId, audience) {
  const privateKeyPem = fs.readFileSync(privateKeyPath);
  const privateKey = await jose.importPKCS8(privateKeyPem, 'RS256');

  const assertion = await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(clientId)
    .setSubject(clientId)
    .setAudience(audience)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime('2 minutes')
    .sign(privateKey);

  return assertion;
}
```

You should expose an endpoint on your backend that generates this assertion and passes it to your frontend.

---

## Frontend Implementation: Embedding the Iframe

On your frontend, you will embed the iframe and communicate with it using `window.postMessage()`.

**1. Embed the Iframe**

Add the iframe element to your page. The `src` attribute should point to the map application's iframe page (e.g., `http://localhost:5173/map-iframe`).

```html
<iframe
  id="map-iframe"
  src="http://localhost:5173/map-iframe"
  width="100%"
  height="600"
  frameborder="0"
></iframe>
```

**2. Initialize the Iframe**

Once the iframe has loaded, you must send an `init` message containing the JWT Assertion you generated on your backend.

```javascript
const iframe = document.getElementById('map-iframe');

// It's crucial to wait for the iframe to fully load before posting a message.
iframe.addEventListener('load', () => {
  // Fetch the assertion from your backend
  fetch('/your-backend/generate-assertion')
    .then(res => res.json())
    .then(data => {
      const assertion = data.assertion;

      // Send the initialization message
      iframe.contentWindow.postMessage({
        action: 'init',
        payload: { assertion }
      }, 'http://localhost:5173'); // Target origin for security
    });
});
```

**3. Listen for Messages from the Iframe**

Add an event listener to your parent window to receive data and status updates from the iframe.

```javascript
window.addEventListener('message', (event) => {
  // Security: always check the origin of the message
  if (event.origin !== 'http://localhost:5173') {
    return;
  }

  const { type, payload } = event.data;
  console.log(`Received message of type: ${type}`, payload);

  // Handle different message types
  if (type === 'initialized') {
    // Now you can enable UI elements to interact with the map
  } else if (type === 'regionDataLoaded') {
    // Display the region data in your UI
  } else if (type === 'pinCreated') {
    // Display the new pin's information
  } else if (type === 'auth_error' || type === 'error') {
    // Handle any errors
  }
});
```

---

## Communication Protocol

All communication between your page and the iframe happens via `window.postMessage()`.

### Parent to Iframe

You can send the following messages to the iframe's `contentWindow`:

-   **Initialization (Required)**
    -   **Action:** `init`
    -   **Payload:** `{ assertion: 'your_jwt_assertion' }`
    -   **Description:** This must be the first message sent. It authenticates the iframe session.

-   **Prefix Search**
    -   **Action:** `searchPrefix`
    -   **Payload:** `{ phoneNumber: '21' }`
    -   **Description:** Triggers a search for the phone prefix. The map will display the boundary and send the corresponding data back to your page.

### Iframe to Parent

You should listen for the following message types from the iframe:

-   **Initialized**
    -   **Type:** `initialized`
    -   **Description:** Sent after the iframe successfully authenticates. It is now ready to accept commands.

-   **Region Data Loaded**
    -   **Type:** `regionDataLoaded`
    -   **Payload:** An object containing `matchedPrefix` and an array of `regions`.
    -   **Description:** The result of a successful `searchPrefix` command.

-   **Pin Created**
    -   **Type:** `pinCreated`
    -   **Payload:** An object with `lat`, `lng`, and `adminInfo` (provinsi, kabkota, etc.).
    -   **Description:** Sent when a user clicks on the map to create a temporary pin.

-   **Authentication Error**
    -   **Type:** `auth_error`
    -   **Payload:** `{ message: 'Error description...' }`

-   **General Error**
    -   **Type:** `error`
    -   **Payload:** `{ message: 'Error description...' }`
