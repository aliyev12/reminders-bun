## Create new reminder
curl --location 'http://localhost:8080/reminders' \
--header 'Content-Type: application/json' \
--header 'X-API-Key: SECRET_KEY' \
--data-raw '{
    "title": "Buy gifts from amazon 22434343",
    "date": "2026-27-30T04:58:47.231Z", 
    "reminders": [{"mode": "email", "address": "dev7c4@gmail.com"}], 
    "alerts": [1000],
    "is_recurring": false,
    "description": "This is a reminder to go and buy a bunch of gifts from amazon"
}'

## Update Reminder
curl --location --request PUT 'http://localhost:8080/reminders/28' \
--header 'Content-Type: application/json' \
--header 'X-API-Key: SECRET_KEY' \
--data-raw '{
    "title": "222222@#@# Buy gifts from amazon 22434343",
    "date": "2025-11-30T04:58:47.231Z", 
    "reminders": [{"mode": "email", "address": "dev7c4@gmail.com"}], 
    "alerts": [1000],
    "is_recurring": false,
    "description": "This is a reminder to go and buy a bunch of gifts from amazon"
}'

## Get All Reminders
curl --location 'http://localhost:8080/reminders/all' \
--header 'X-API-Key: SECRET_KEY'

## Get All Active Reminders
curl --location 'http://localhost:8080/reminders' \
--header 'X-API-Key: SECRET_KEY'

## Delete Reminder
curl --location --request DELETE 'http://localhost:8080/reminders/14' \
--header 'X-API-Key: SECRET_KEY'

## Delete Reminders Bulk
curl --location --request DELETE 'http://localhost:8080/reminders/bulk?ids=38-60' \
--header 'X-API-Key: SECRET_KEY'

## Webhook Reminder Alert
TODO: needs to be implemented:
POST at /webhooks/reminder-alert