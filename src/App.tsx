import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { useFormik } from 'formik';
import { DeleteIcon } from '@chakra-ui/icons';
import useSWR, { KeyedMutator } from 'swr';
import _ from 'lodash';
import YouTube from 'react-youtube';
import * as C from '@chakra-ui/react';

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
  videos_played: number;
  last_played_timestamp: number;
  video_queue: string[];
};

const fakeData: UserStatus[] = [
  {
    name: 'kari',
    id: 'abc123',
    videos_played: 0,
    last_played_timestamp: 0,
    video_queue: ['DXOPAHGOmL4', 'ozOLfaHtL5I'],
  },
  {
    name: 'seppo',
    id: 'def456',
    videos_played: 0,
    last_played_timestamp: 0,
    video_queue: ['7WXEKPmpWQ4', 'OUwhq8GxFvw'],
  },
  {
    name: 'ismo',
    id: 'ghi789',
    videos_played: 0,
    last_played_timestamp: 0,
    video_queue: ['rId8Dg--TQA', 'Fu84xJ7YXcc'],
  },
];

let fakeAPIStatuses: UserStatus[] = [];

async function getUserStatuses(url: string) {
  // TODO: get user statuses from API
  return fakeAPIStatuses;
}

function getNextUser(userStatuses: UserStatus[]): UserStatus | undefined {
  return _.minBy(
    userStatuses.filter((user) => user.video_queue.length > 0),
    'last_played_timestamp'
  );
}

function getNextVideo({
  userStatuses,
}: {
  userStatuses: UserStatus[];
}): { userId: string; videoId: string } | null {
  const nextUser = getNextUser(userStatuses);
  if (!nextUser) {
    return null;
  }
  const nextVideoId = nextUser.video_queue[0];
  return { userId: nextUser.id, videoId: nextVideoId };
}

function updateVideoQueue({
  userStatuses,
  mutateUserStatuses,
  nextUserId,
}: {
  userStatuses: UserStatus[];
  mutateUserStatuses: KeyedMutator<UserStatus[]>;
  nextUserId: string;
}) {
  const newUserStatuses = userStatuses.map((user) => {
    if (user.id === nextUserId) {
      return {
        ...user,
        video_queue: user.video_queue.slice(1),
        videos_played: user.videos_played + 1,
        last_played_timestamp: Date.now(),
      };
    }
    return user;
  });

  fakeAPIStatuses = newUserStatuses;
  mutateUserStatuses(newUserStatuses, false);
}

function YoutubePage({
  userStatuses,
  nextVideo,
  mutateUserStatuses,
}: {
  userStatuses: UserStatus[];
  nextVideo: { userId: string; videoId: string } | null;
  mutateUserStatuses: KeyedMutator<UserStatus[]>;
}) {
  const [currentlyPlaying, setCurrentlyPlaying] = React.useState<{
    userId: string;
    videoId: string;
  } | null>(null);

  React.useEffect(() => {
    if (currentlyPlaying) {
      updateVideoQueue({
        userStatuses,
        mutateUserStatuses,
        nextUserId: currentlyPlaying.userId,
      });
    }
  }, [currentlyPlaying]);

  // Trigger next video if no current video but we have videos in queue for users
  if (!currentlyPlaying && nextVideo) {
    setCurrentlyPlaying(nextVideo);
  }

  if (!nextVideo && !currentlyPlaying) {
    return (
      <C.Box>
        No videos in queue found
        <C.Button
          onClick={() => {
            fakeAPIStatuses = fakeData;
          }}>
          Lisää ismo videoita
        </C.Button>
      </C.Box>
    );
  }

  if (currentlyPlaying?.videoId) {
    return (
      <C.Box>
        <YouTube
          opts={opts}
          videoId={currentlyPlaying?.videoId}
          onEnd={() => {
            if (nextVideo) {
              setCurrentlyPlaying(nextVideo);
            } else {
              setCurrentlyPlaying(null);
            }
          }}
        />
        <C.Button
          onClick={() => {
            fakeAPIStatuses = fakeData;
          }}>
          Lisää ismo video
        </C.Button>
      </C.Box>
    );
  }

  return <C.Center>No videos in queue found</C.Center>;
}

function RoomForOwner() {
  const {
    data: userStatuses,
    isLoading,
    mutate: mutateUserStatuses,
  } = useSWR('/api/user_statuses', getUserStatuses, { refreshInterval: 5000 });
  const [nextVideo, setNextVideo] = React.useState<{
    userId: string;
    videoId: string;
  } | null>(null);

  React.useEffect(() => {
    if (userStatuses) {
      setNextVideo(getNextVideo({ userStatuses }));
    }
  }, [userStatuses]);

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

  return (
    <C.Container h="calc(100vh)">
      <C.Stack spacing={8} p={4}>
        <C.Heading>This is YouTube scheduler app</C.Heading>

        <C.Box>
          <C.Heading size="md">Users:</C.Heading>
          {userStatuses.map((user) => (
            <C.Text key={user.id}>
              {user.name} - {user.videos_played} videos played - {user.id}
            </C.Text>
          ))}
        </C.Box>

        <AddUser
          onAddUser={(name: string) => {
            const newUserStatuses = [
              ...userStatuses,
              {
                name,
                id: window.crypto.randomUUID(),
                videos_played: 0,
                last_played_timestamp: 0,
                video_queue: [],
              },
            ];
            mutateUserStatuses(newUserStatuses, false);
            fakeAPIStatuses = newUserStatuses;
          }}
        />

        <C.Box>
          <YoutubePage
            userStatuses={userStatuses}
            mutateUserStatuses={mutateUserStatuses}
            nextVideo={nextVideo}
          />
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
  const [videoQueue, setVideoQueue] = React.useState<string[]>([]);
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
    onSubmit: (values) => {
      setVideoQueue([...videoQueue, values.videoIdOrUrl]);
    },
  });

  return (
    <C.Container h="calc(100vh)">
      <C.Stack spacing={8} p={4}>
        <C.Heading>This is YouTube scheduler app</C.Heading>
        <C.Box>
          <C.Heading size="md">You are user</C.Heading>
        </C.Box>
        <C.Box>
          <form onSubmit={formik.handleSubmit}>
            <label htmlFor="videoIdOrUrl">Add video to queue</label>
            <C.Input
              id="videoIdOrUrl"
              name="videoIdOrUrl"
              type="text"
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
                onClick={() => {
                  setVideoQueue(videoQueue.filter((id) => id !== videoId));
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
  return (
    <C.Container h="calc(100vh)">
      <C.Center>
        <C.Heading>This is YouTube scheduler app</C.Heading>
        <Link to="/room">Create room</Link>
      </C.Center>
    </C.Container>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/room" element={<RoomForOwner />} />
      <Route path="/user" element={<RoomForUser />} />
    </Routes>
  );
}

export default App;
