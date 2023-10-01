import React from 'react';
import { Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import { DeleteIcon } from '@chakra-ui/icons';
import useSWR, { KeyedMutator } from 'swr';
import _ from 'lodash';
import YouTube from 'react-youtube';
import * as C from '@chakra-ui/react';
import { createRoom, createUser, getUsersForOwner, updateUserVideoQueue } from './callApi';

const opts = {
  height: '390',
  width: '640',
  playerVars: {
    autoplay: 1,
  },
};

type UserStatus = {
  name: string;
  id: string;
  video_queue: string[];
};

async function getUserStatuses([path, id]: [string, string]) {
  return await getUsersForOwner(id);
}

async function getVideoQueue([path, id]: [string, string]) {
  return await getVideoQueueForUser(id);
}

const getNextVideo = ({
  userStatuses,
  lastPlayedTimestamps,
}: {
  userStatuses: UserStatus[];
  lastPlayedTimestamps: { [key: string]: number };
}): { userId: string; videoId: string } | null => {
  const usersWithVideosInQueue = userStatuses.filter((user) => user.video_queue.length > 0);
  const usersNotInTimestampObject = usersWithVideosInQueue.filter(
    (user) => !lastPlayedTimestamps[user.id]
  );
  if (usersNotInTimestampObject.length > 0) {
    const nextUserId = usersNotInTimestampObject[0].id;
    const nextVideoId = userStatuses.find((user) => user.id === nextUserId)?.video_queue[0];
    if (!nextVideoId) {
      throw new Error('There must be a video in queue before scheduling next video');
    }
    return { userId: nextUserId, videoId: nextVideoId };
  }
  const nextUserId = _.minBy(usersWithVideosInQueue, (user) => lastPlayedTimestamps[user.id])?.id;
  if (!nextUserId) {
    return null;
  }
  const nextVideoId = userStatuses.find((user) => user.id === nextUserId)?.video_queue[0];
  if (!nextVideoId) {
    throw new Error('There must be a video in queue before scheduling next video');
  }
  return { userId: nextUserId, videoId: nextVideoId };
};

function YoutubePage({
  userStatuses,
  mutateUserStatuses,
}: {
  userStatuses: UserStatus[];
  mutateUserStatuses: KeyedMutator<UserStatus[]>;
}) {
  const [currentlyPlaying, setCurrentlyPlaying] = React.useState<{
    userId: string;
    videoId: string;
  } | null>(null);
  const [lastPlayedTimestamps, setLastPlayedTimestamps] = React.useState<{ [key: string]: number }>(
    {}
  );
  const nextVideo = React.useMemo(
    () => getNextVideo({ userStatuses, lastPlayedTimestamps }),
    [userStatuses, lastPlayedTimestamps]
  );

  // Trigger next video if no current video but we have videos in queue for users
  if (!currentlyPlaying && nextVideo) {
    updateUserVideoQueue({
      id: nextVideo.userId,
      video_queue:
        userStatuses.find((user) => user.id === nextVideo.userId)?.video_queue.slice(1) || [],
    }).then(() => {
      setLastPlayedTimestamps({ ...lastPlayedTimestamps, [nextVideo.userId]: Date.now() });
      setCurrentlyPlaying(nextVideo);
      mutateUserStatuses();
    });
  }

  if (!nextVideo && !currentlyPlaying) {
    return <C.Box>No videos in queue found</C.Box>;
  }

  if (currentlyPlaying?.videoId) {
    return (
      <C.Box>
        <YouTube
          opts={opts}
          videoId={currentlyPlaying?.videoId}
          onEnd={async () => {
            const nextVideo = getNextVideo({ userStatuses, lastPlayedTimestamps });
            if (nextVideo) {
              await updateUserVideoQueue({
                id: nextVideo.userId,
                video_queue:
                  userStatuses.find((user) => user.id === nextVideo.userId)?.video_queue.slice(1) ||
                  [],
              });
              setCurrentlyPlaying(nextVideo);
              setLastPlayedTimestamps({ ...lastPlayedTimestamps, [nextVideo.userId]: Date.now() });
            } else {
              setCurrentlyPlaying(null);
            }
            mutateUserStatuses();
          }}
        />
      </C.Box>
    );
  }

  return <C.Center>No videos in queue found</C.Center>;
}

function RoomForOwner() {
  const { id } = useParams<{ id: string }>();
  const {
    data: userStatuses,
    isLoading,
    mutate: mutateUserStatuses,
  } = useSWR(['/api/user_statuses', id], getUserStatuses, { refreshInterval: 5000 });

  if (!userStatuses && isLoading) {
    return (
      <C.Box>
        <C.Spinner />
      </C.Box>
    );
  }

  if (!userStatuses) {
    return <C.Box>Failed to load user data</C.Box>;
  }

  if (!id) {
    return <C.Box>Invalid room id</C.Box>;
  }

  return (
    <C.Container h="calc(100vh)">
      <C.Stack spacing={8} p={4}>
        <C.Heading>This is YouTube scheduler app</C.Heading>

        <C.Box>
          <C.Heading size="md">Users:</C.Heading>
          {userStatuses.map((user) => (
            <C.Text key={user.id}>
              {user.name} - {user.id}
            </C.Text>
          ))}
        </C.Box>

        <AddUser
          onAddUser={async (name: string) => {
            await createUser({ name, ownerId: id });
            const users = await getUsersForOwner(id);
            mutateUserStatuses(users, false);
          }}
        />

        <C.Box>
          <YoutubePage userStatuses={userStatuses} mutateUserStatuses={mutateUserStatuses} />
        </C.Box>
      </C.Stack>
    </C.Container>
  );
}

function validateYoutubeIdOrUrl(value: string) {
  if (!value) {
    return 'Required';
  }
  if (
    !value.match(/^[a-zA-Z0-9_-]{11}$/) &&
    !value.match(/^(http(s)?:\/\/)?((w){3}.)?youtu(be|.be)?(\.com)?\/.+/)
  ) {
    return 'Invalid YouTube video id or url';
  }
  return;
}

function AddUser({ onAddUser }: { onAddUser: (name: string) => void }) {
  const formik = useFormik({
    initialValues: {
      name: '',
    },
    onSubmit: async (values) => {
      onAddUser(values.name);
    },
  });

  return (
    <C.Box>
      <form onSubmit={formik.handleSubmit}>
        <label htmlFor="name">Add user</label>
        <C.Input
          id="name"
          name="name"
          type="text"
          onChange={formik.handleChange}
          value={formik.values.name}
        />
        <C.Button type="submit">Add user</C.Button>
      </form>
    </C.Box>
  );
}

function RoomForUser() {
  const { id } = useParams<{ id: string }>();
  const { data: videoQueue, mutate: mutateVideoQueue } = useSWR(
    ['/video-queue/user_statuses', id],
    getVideoQueue,
    { refreshInterval: 5000 }
  );

  const formik = useFormik({
    initialValues: {
      videoIdOrUrl: '',
    },
    validate: (values) => {
      const errors: Record<string, string> = {};
      const error = validateYoutubeIdOrUrl(values.videoIdOrUrl);
      if (error) {
        errors.videoIdOrUrl = error;
      }
      return errors;
    },
    onSubmit: async (values) => {
      const videoIdMatch = values.videoIdOrUrl.match(/([a-zA-Z0-9_-]{11})/);
      const [videoId] = videoIdMatch || [];
      if (videoQueue && id && videoId) {
        await mutateVideoQueue();
        const newQueue = [...videoQueue, videoId];
        await updateUserVideoQueue({ id, video_queue: newQueue });
        mutateVideoQueue(newQueue);
      }
    },
  });

  if (!id) {
    throw new Error('Must have user id');
  }
  if (!videoQueue) {
    return (
      <C.Center>
        <C.Spinner />
      </C.Center>
    );
  }

  return (
    <C.Stack spacing={4} p={4}>
        <form onSubmit={formik.handleSubmit}>
          <C.HStack>
            <C.Input
              id="videoIdOrUrl"
              name="videoIdOrUrl"
              type="text"
              placeholder="Add Youtube video id or URL"
              onChange={formik.handleChange}
              value={formik.values.videoIdOrUrl}
            />
            {formik.errors.videoIdOrUrl ? (
              <C.Text color="red">{formik.errors.videoIdOrUrl}</C.Text>
            ) : null}
            <C.Button type="submit">Add video</C.Button>
          </form>
          <C.Heading size="md">Videos in queue</C.Heading>
          {videoQueue.map((videoId) => (
            <C.Box key={videoId}>
              <C.Heading size="md">{videoId}</C.Heading>
              <C.Button
                onClick={async () => {
                  const newQueue = videoQueue.slice(1);
                  await updateUserVideoQueue({
                    id,
                    video_queue: newQueue,
                  });
                  setVideoQueue(newQueue);
                }}>
                <DeleteIcon />
              </C.Button>
            </C.Box>
          ))}
        </C.Box>
      </C.Stack>
    </C.Container>
  );
}

function LandingPage() {
  const navigate = useNavigate();
  return (
    <C.Container h="calc(100vh)">
      <C.Center>
        <C.Heading>This is YouTube scheduler app</C.Heading>
        <C.Button
          onClick={async () => {
            const { id } = await createRoom();
            navigate(`/room/${id}`);
          }}>
          Click to create a room
        </C.Button>
      </C.Center>
    </C.Container>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/room/:id" element={<RoomForOwner />} />
      <Route path="/user/:id" element={<RoomForUser />} />
    </Routes>
  );
}

export default App;
