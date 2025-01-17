# Интеграция GREEN-API для Rocket.Chat

- [Documentation in English](./README.md)

Эта интеграция обеспечивает взаимодействие с WhatsApp в Rocket.Chat через платформу GREEN-API. Разработана на
базе [Universal Integration Platform](https://github.com/green-api/greenapi-integration) от GREEN-API и состоит из двух
частей:

1. Адаптер - приложение NestJS, обеспечивающее взаимодействие между Rocket.Chat и GREEN-API
2. Приложение Rocket.Chat - сопутствующее приложение, предоставляющее слэш-команды для управления интеграцией

## Архитектура

### Адаптер

Приложение NestJS, которое:

- Обрабатывает преобразование сообщений между Rocket.Chat и WhatsApp
- Управляет инстансами GREEN-API
- Обрабатывает аутентификацию пользователей и выполнение команд
- Предоставляет конечные точки для вебхуков обеих платформ

### Приложение Rocket.Chat

Приложение Rocket.Chat, предоставляющее слэш-команды:

- `/greenapi.register` - Регистрация нового пользователя
- `/greenapi.create-instance` - Создание нового инстанса GREEN-API
- `/greenapi.remove-instance` - Удаление существующего инстанса
- `/greenapi.update-token` - Обновление токенов аутентификации Rocket.Chat
- `/greenapi.sync-app-url` - Синхронизация URL-адресов вебхуков всех инстансов с текущим URL приложения

## Предварительные требования

- База данных PostgreSQL
- Node.js 20 или выше
- Аккаунт и инстанс GREEN-API
- Сервер Rocket.Chat (коробочная или облачная версия)

## Установка

### Настройка адаптера

1. Склонируйте репозиторий:

```bash
git clone [repository-url]
cd greenapi-integration-rocketchat
```

2. Установите зависимости:

```bash
npm install
```

3. Настройте переменные окружения в файле `.env`:

```env
DATABASE_URL=mysql://user:password@localhost:3306/rocket_adapter
APP_URL=https://your-domain.com
```

4. Примените миграции:

```bash
npx prisma migrate deploy
```

5. Соберите и запустите адаптер:

```bash
# Сборка приложения
npm run build

# Запуск в production режиме
npm run start:prod
```

### Установка приложения Rocket.Chat

1. Перейдите в панель администрирования Rocket.Chat
2. Перейдите в раздел Apps -> Private Apps -> Upload Private App
3. Выберите файл `greenapi_X.X.X.zip` из папки проекта
   `greenapi-integration-rocketchat-app/app`
   и загрузите его
4. Настройте URL-адрес в настройках загруженного приложения, указав адрес вашего адаптера
5. Теперь вы можете использовать все вышеуказанные команды

## Развертывание

Адаптер может быть развернут с использованием Docker Compose. Конфигурационные файлы:

### Настройка Docker Compose

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

Для развертывания с помощью Docker Compose:

```bash
# Запуск всех сервисов
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановка всех сервисов
docker-compose down
```

Примечание: Данные файлы предоставлены в качестве примера и могут требовать корректировок в зависимости от ваших
конкретных условий и требований развертывания.

### Важное примечание для самостоятельного развертывания

Если вы разворачиваете адаптер на собственном сервере, для работы адаптера требуется публичный URL-адрес (APP_URL),
доступный из интернета. Это необходимо для:

- Получения вебхуков от GREEN-API
- Обеспечения связи между Rocket.Chat и адаптером

При самостоятельном развертывании убедитесь, что вы:

1. Настроили сеть/файрвол для разрешения входящих соединений
2. Настроили доменное имя или статический IP-адрес
3. Настроили SSL/TLS для безопасного соединения
4. Установили переменную окружения APP_URL, указав ваш публичный URL-адрес

## Использование приложения

### 1. Зарегистрируйте свой аккаунт в адаптере:

```
/greenapi.register [rocket-chat-id] [rocket-chat-token]
```

- `rocket-chat-id`: Ваш ID в Rocket.Chat
- `rocket-chat-token`: Ваш персональный API токен Rocket.Chat

В ответе вы получите командный токен. **Вам необходимо вставить этот токен в настройках приложения GREEN-API:**

1. Нажмите ⋮ в левом верхнем углу домашней страницы Rocket.chat
2. Перейдите в Marketplace > Private Apps > GREEN-API > Settings
3. Найдите поле "Command token"
4. Вставьте ваш токен
5. Сохраните изменения

![Настройки командного токена GREEN-API](./assets/command-token-settings.png)

### 2. Создайте инстанс GREEN-API:

```
/greenapi.create-instance [instance-id] [instance-token]
```

- `instance-id`: ID вашего инстанса GREEN-API
- `instance-token`: API токен вашего инстанса GREEN-API

3. Подождите примерно 2 минуты, пока применятся настройки.


4. Для проверки соединения напишите сообщение на номер WhatsApp, подключенный к вашему инстансу GREEN-API - в
   Rocket.Chat появится новый чат с этим сообщением.


5. Начните использовать WhatsApp в Rocket.Chat!

### Другие доступные команды:

```
// Удалить созданный инстанс (только в базе данных адаптера)
/greenapi.remove-instance [instance-id]

// Обновить токен rocket.chat (только в базе данных адаптера)
/greenapi.update-token [rocket-chat-id] [rocket-chat-token]

// Синхронизировать URL-адреса вебхуков всех инстансов с текущим URL приложения
/greenapi.sync-app-url
```

Команда sync-app-url особенно полезна, когда вы изменили URL-адрес вашего адаптера или перенесли его на другой домен.
Она автоматически обновляет настройки URL-адресов вебхуков для всех ваших зарегистрированных инстансов GREEN-API, чтобы
они соответствовали текущему URL приложения, указанному в настройках приложения GREEN-API в Rocket.Chat.

## Лицензия

MIT
