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

For administrators:

- `/greenapi.register-workspace` - Register your Rocket.Chat workspace
- `/greenapi.list-instances` - List all instances in the workspace
- `/greenapi.list-users` - List all registered users in the workspace
- `/greenapi.sync-app-url` - Synchronize webhook URLs of all instances with the current app URL

For livechat agents:

- `/greenapi.register-agent` - Register yourself as a livechat agent
- `/greenapi.create-instance` - Create a new GREEN-API instance
- `/greenapi.update-token` - Update Rocket.Chat authentication token

For both roles:

- `/greenapi.remove-instance` - Admins can remove any instances, agents can only remove their own instances

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

## Important Notes

### User Roles and Permissions

The integration uses Rocket.Chat's role system:

1. **Administrator Role**
    - Can register workspaces
    - Can view all instances and users in the workspace
    - Can remove any instance
    - Can synchronize app URLs
    - No need to register as an agent to use admin commands

2. **Livechat Agent Role**
    - Must register themselves first using `/greenapi.register-agent`
    - Can create their own instances
    - Can update their authentication token
    - Can remove only their instances

### How to Get Your Rocket.Chat Credentials

To obtain your `rocket-chat-id` and `rocket-chat-token`:

1. Click your avatar in Rocket.Chat
2. Go to "Personal Access Tokens" under Account settings
3. Enter a name for your token or leave it blank and click "Add"
4. After verification, you will be shown both your User ID and Access Token
    - Save both values immediately as the token will only be shown once
    - The User ID is your `rocket-chat-id`
    - The Access Token is your `rocket-chat-token`

Note: For workspace registration (`/greenapi.register-workspace`), the user must have admin role. For agent
registration (`/greenapi.register-agent`), the livechat-agent role is required.

### Self-Hosted Deployments

If you're deploying the adapter on your own server, the adapter requires a public
URL (APP_URL) that is accessible from the internet. This is necessary for:

- Receiving webhooks from GREEN-API
- Allowing Rocket.Chat to communicate with the adapter

For self-hosted deployments, make sure to:

1. Configure your network/firewall to allow incoming connections
2. Set up a domain name or static IP
3. Configure SSL/TLS for secure communication
4. Set the APP_URL environment variable to your public URL

### File Sharing Configuration

For agents to be able to send files to WhatsApp, you need to ensure that public file access is enabled in your
Rocket.Chat workspace. To configure this:

1. Click ⋮ (three vertical dots) in the top left corner of the Rocket.Chat home page
2. Click workspace
3. Click settings at the bottom of the sidebar
4. Search for "File Upload" and open it.
5. Disable setting "Protect Uploaded Files"

If this setting remains enabled, agents will not be able to send files to WhatsApp contacts.

### Setting Up Livechat Agents in Rocket.Chat

Before registering as an agent in this integration, users need to be set up as livechat agents in Rocket.Chat:

1. Click ⋮ (three vertical dots) in the top left corner of the Rocket.Chat home page
2. Go to Omnichannel
3. Navigate to Agents section
4. Search for the user by their username you want to make an agent
5. Select the user and click "Add agent"

Only after a user is set up as a livechat agent in Rocket.Chat can they register as an agent in this integration using
the `/greenapi.register-agent` command. An agent will only receive incoming chats if they are available. If they are
not available, the chat will go to the next available agent. If there are no available agents, the chat will be in the
"Queued" status and will need to be manually taken.

### Message Quoting Behavior

When using message quotes in Rocket.Chat:

- Agents can quote customer messages from WhatsApp
- If agents quote their own messages, these quotes won't be visible in WhatsApp, only the message itself.

## App usage

### 1. Register your workspace in the adapter (requires admin role):

```
/greenapi.register-workspace [rocket-chat-id] [rocket-chat-token]
```

- `rocket-chat-id`: Your Rocket.Chat ID
- `rocket-chat-token`: Your Rocket.Chat personal API token

### 2. Register users in your workspace:

```
/greenapi.register-agent [rocket-chat-id] [rocket-chat-token]
```

- `rocket-chat-id`: User's Rocket.Chat ID
- `rocket-chat-token`: User's Rocket.Chat personal API token

This command requires:

- The workspace to be registered first
- The user to have the livechat-agent role

**For an agent to have an ability to answer in a WhatsApp chat, they must be registered through this command first.**

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

For agents:

```
# Create a new instance
/greenapi.create-instance [instance-id] [instance-token]

# Remove your own instance
/greenapi.remove-instance [instance-id]

# Update your authentication token
/greenapi.update-token [rocket-chat-id] [new-rocket-chat-token]
```

For admins:

```
# List all instances in workspace
/greenapi.list-instances

# List all registered agents
/greenapi.list-users

# Remove any instance
/greenapi.remove-instance [instance-id]

# Sync app URL for all instances
/greenapi.sync-app-url [new-app-url]
```

The sync-app-url command is particularly useful when you've changed your adapter's URL or moved it to a different
domain. It automatically updates the webhook URL settings for all your registered GREEN-API instances. Note: Your new
app URL must end with "api/webhook/rocket" for proper webhook mapping.

## License

Licensed
under [Creative Commons Attribution-NoDerivatives 4.0 International (CC BY-ND 4.0)](https://creativecommons.org/licenses/by-nd/4.0/).

[LICENSE](./LICENSE)
