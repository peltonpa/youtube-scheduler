# Youtube scheduler app  
This app is a tool for scheduling turns for Youtube videos in one device from multiple users individual queues. Example use case is gathering with friends and people wanting to put music on in turns. With this app everyone can schedule their own queue from their device, and a device connected to speakers will play Youtube giving turns to each users so that everyone's tunes go in orderly fashion.

This app runs in conjunction with an API that stores the users and their queues. The code for the API is found at https://github.com/peltonpa/youtube-scheduler-api

Note that you either need to host the API somewhere for thie app to work over the internet or have the users be on same network where the API is running (or use browser tabs in the main user who is connected to speaker).

More detailed instructions:
1. main user (user connected to speaker) loads the app
2. creates a room
3. adds users
4. each user has an id, and they can go to `<app-url>/user/:id` (ids visible in main user page)
5. users start adding videos
6. the main user (connected to speaker) starts automatically playing videos from the users in turns
7. if videos run out in the queues, the main user will periodically refresh the current queue statuses and when there are new videos, it starts autoplaying them in order again

## Running the app locally
Run the API first (https://github.com/peltonpa/youtube-scheduler-api)

After that, run:
`REACT_APP_API_URL=http://localhost:5001 npm start`
