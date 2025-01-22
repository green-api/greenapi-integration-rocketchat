# GREEN-API Integration with Rocket.Chat

- [Документация на русском языке](./README.ru.md)

This integration enables WhatsApp communication in Rocket.Chat using the GREEN-API platform. Built on
the [Universal Integration Platform](https://github.com/green-api/greenapi-integration) by GREEN-API, it consists of two
parts:

1. The adapter service - A NestJS application that handles communication between Rocket.Chat and GREEN-API
2. The Rocket.Chat app - A companion app that provides slash commands for managing the integration

## Architecture

### Adapter Service

A NestJS application that:

- Handles message transformation between Rocket.Chat and WhatsApp
- Manages GREEN-API instances
- Handles user authentication and command processing
- Provides webhook endpoints for both platforms

### Rocket.Chat App

A Rocket.Chat application that provides slash commands:

- `/greenapi.register-workspace` - Register your Rocket.Chat workspace
- `/greenapi.register-user` - Register a new user
- `/greenapi.create-instance` - Create a new GREEN-API instance
- `/greenapi.remove-instance` - Remove an existing instance
- `/greenapi.update-token` - Update Rocket.Chat authentication tokens
- `/greenapi.sync-app-url` - Synchronize webhook URLs of all instances with the current app URL

## Prerequisites

- MySQL database (5.7 or higher)
- Node.js 20 or higher
- GREEN-API account and instance
- Rocket.Chat server (self-hosted or cloud version)

## Installation

### Setting up the Adapter

1. Clone the repository:

```bash
git clone [repository-url]
cd greenapi-integration-rocketchat
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables in `.env`:

```env
DATABASE_URL=mysql://user:password@localhost:3306/rocket_adapter
APP_URL=https://your-domain.com
```

4. Apply migrations:

```bash
npx prisma migrate deploy
```

5. Build and start the adapter:

```bash
# Build the application
npm run build

# Start in production mode
npm run start:prod
```

### Installing the Rocket.Chat App

1. Go to Rocket.Chat administration panel
2. Navigate to Apps -> Private Apps -> Upload Private App
3. Select the `greenapi_X.X.X.zip` file inside the `greenapi-integration-rocketchat-app/app`
   project folder and upload it.
4. Configure the app URL in settings to point to your adapter instance
5. You can now use all the aforementioned commands.

## Deployment

The adapter can be deployed using Docker Compose. Configuration files:

### Docker Compose Setup

```yaml
version: '3.8'

services:
  adapter:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - APP_URL=${APP_URL}
    depends_on:
      - db

  db:
    image: mysql:8
    environment:
      - MYSQL_ROOT_PASSWORD=root_password
      - MYSQL_USER=user
      - MYSQL_PASSWORD=password
      - MYSQL_DATABASE=rocket_adapter
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

### Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
CMD npx prisma migrate deploy && npm run start:prod
```

To deploy using Docker Compose:

```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop all services
docker-compose down
```

Note: The deployment configuration is provided as a reference and may need adjustments based on your specific
environment and requirements.

### Important Note for Self-Hosted Deployments

If you're deploying the adapter on your own server, the adapter requires a public
URL (APP_URL) that is accessible from the internet. This is necessary for:

- Receiving webhooks from GREEN-API
- Allowing Rocket.Chat to communicate with the adapter

For self-hosted deployments, make sure to:

1. Configure your network/firewall to allow incoming connections
2. Set up a domain name or static IP
3. Configure SSL/TLS for secure communication
4. Set the APP_URL environment variable to your public URL

## App usage

### 1. Register your workspace in the adapter:

```
/greenapi.register-workspace [rocket-chat-id] [rocket-chat-token]
```

- `rocket-chat-id`: Your Rocket.Chat ID (with admin rights or view-livechat-manager permission)
- `rocket-chat-token`: Your Rocket.Chat personal API token

In the response you will receive a workspace command token. **You need to paste this token in the GREEN-API app
settings:**

1. Click ⋮ on the top left of the Rocket.chat home page
2. Go to Marketplace > Private Apps > GREEN-API > Settings
3. Find the "Command token" field
4. Paste your workspace token there
5. Save changes

![GREEN-API Command Token Settings](./assets/command-token-settings.png)

### 2. Register users in your workspace:

```
/greenapi.register-user [rocket-chat-id] [rocket-chat-token]
```

- `rocket-chat-id`: User's Rocket.Chat ID
- `rocket-chat-token`: User's Rocket.Chat personal API token

This command requires the workspace to be registered first and the workspace command token to be set in app settings.

### 3. Create a GREEN-API instance:

```
/greenapi.create-instance [instance-id] [instance-token]
```

- `instance-id`: Your GREEN-API instance ID
- `instance-token`: Your GREEN-API instance API token

### 4. Wait for settings:

Wait approximately 2 minutes for the instance settings to apply.

### 5. Test the connection:

Write a message to a WhatsApp number connected to your GREEN-API instance - a new chat with
the message will appear in Rocket.Chat.

### 6. Start messaging:

You can now use WhatsApp in Rocket.Chat!

### Other available commands:

```
// remove the created instance (only in the adapter database)
/greenapi.remove-instance [instance-id]

// update your rocket.chat token (only in the adapter database)
/greenapi.update-token [rocket-chat-id] [rocket-chat-token]

// synchronize webhook URLs of all instances with the current app URL
/greenapi.sync-app-url
```

The sync-app-url command is particularly useful when you've changed your adapter's URL or moved it to a different
domain. It automatically updates the webhook URL settings for all your registered GREEN-API instances to match the
current app URL defined in your Rocket.Chat GREEN-API app settings.

## License

MIT
