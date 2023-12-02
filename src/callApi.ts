import axios from 'axios';
import { isRight } from 'fp-ts/Either';
import * as t from 'io-ts';
import { PathReporter } from 'io-ts/PathReporter';

const API_URL = process.env.REACT_APP_API_URL;

const API_RESPONSE = t.exact(
  t.type(
    {
      data: t.type({
        data: t.unknown,
      }),
    },
    'API_RESPONSE'
  )
);

const callApi = async (path: string, options: any) => {
  const response = await axios(`${API_URL}/${path}`, options);
  const responseData = API_RESPONSE.decode(response);
  if (!isRight(responseData)) {
    const report = PathReporter.report(responseData);
    console.error('Invalid API response shape', { report });
    throw new Error('Invalid API response shape');
  }
  return responseData.right.data.data;
};

const decodeUserFromData = (data: unknown) => {
  const decodedUser = USER.decode(data);
  if (!isRight(decodedUser)) {
    const report = PathReporter.report(USER.decode(data));
    console.error('Invalid user data shape', { report });
    throw new Error('Invalid user data shape');
  }
  return decodedUser.right;
};

const decodeUserArrayFromData = (data: unknown) => {
  const arrayOfUsers = t.array(USER).decode(data);
  if (!isRight(arrayOfUsers)) {
    const report = PathReporter.report(USER.decode(data));
    console.error('Invalid user data shape', { report });
    throw new Error('Invalid user data shape');
  }
  console.info('arrayOfUsers', arrayOfUsers);
  return arrayOfUsers.right;
};

const decodeOwnerFromData = (data: unknown) => {
  const decodedOwner = OWNER.decode(data);
  if (!isRight(decodedOwner)) {
    const report = PathReporter.report(OWNER.decode(data));
    console.error('Invalid owner data shape', { report });
    throw new Error('Invalid owner data shape');
  }
  return decodedOwner.right;
};

const decodeVideoQueueFromData = (data: unknown) => {
  const decodedVideoQueue = USER_VIDEO_QUEUE_RESPONSE.decode(data);
  if (!isRight(decodedVideoQueue)) {
    const report = PathReporter.report(USER_VIDEO_QUEUE_RESPONSE.decode(data));
    console.error('Invalid video queue data shape', { report });
    throw new Error('Invalid video queue data shape');
  }
  return decodedVideoQueue.right.video_queue;
}

const decodeVideoTitleFromData = (data: unknown) => {
  const decodedVideoTitle = t.string.decode(data);
  if (!isRight(decodedVideoTitle)) {
    const report = PathReporter.report(t.string.decode(data));
    console.error('Invalid video title data shape', { report });
    throw new Error('Invalid video title data shape');
  }
  return decodedVideoTitle.right;
}

const USER = t.exact(
  t.type({
    id: t.string,
    name: t.string,
    video_queue: t.array(t.string),
  }),
  'User'
);

const USER_VIDEO_QUEUE_RESPONSE = t.exact(
  t.type({
    id: t.string,
    video_queue: t.array(t.string),
  }),
  'USER_VIDEO_QUEUE_RESPONSE'
);

const OWNER = t.exact(
  t.type({
    id: t.string,
  }),
  'Owner'
);

export const createRoom = async () => {
  const data = await callApi('owner', { method: 'POST' });
  return decodeOwnerFromData(data);
};

export const createUser = async ({ name, ownerId }: { name: string; ownerId: string }) => {
  const data = await callApi('users', { method: 'POST', data: { name, ownerId, video_queue: [] } });
  return decodeUserFromData(data);
};

export const getUsersForOwner = async (ownerId: string) => {
  const data = await callApi(`users/${ownerId}`, { method: 'GET' });
  return decodeUserArrayFromData(data);
};

export const updateUserVideoQueue = async ({
  id,
  video_queue,
}: {
  id: string;
  video_queue: string[];
}) => {
  const data = await callApi(`users/update-video-queue`, {
    method: 'PUT',
    data: { id, video_queue },
  });
  return decodeUserFromData(data);
};

export const getVideoQueueForUser = async (userId: string) => {
  const data = await callApi(`users/video-queue/${userId}`, { method: 'GET' });
  return decodeVideoQueueFromData(data);
}

export const getVideoTitleFromId = async (videoId: string) => {
  const data = await callApi(`video-id/${videoId}`, { method: 'GET' });
  return decodeVideoTitleFromData(data);
}
