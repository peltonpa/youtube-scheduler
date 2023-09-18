import React from 'react';
import useSWR, { KeyedMutator } from 'swr';
import _ from 'lodash';
import YouTube, { YouTubePlayer } from 'react-youtube';
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
  video_queue: string[];
};

const fakeData: UserStatus[] = [
  {
    name: 'kari',
    id: 'abc123',
    videos_played: 0,
    video_queue: ['DXOPAHGOmL4', 'ozOLfaHtL5I'],
  },
  {
    name: 'seppo',
    id: 'def456',
    videos_played: 0,
    video_queue: ['7WXEKPmpWQ4', 'OUwhq8GxFvw'],
  },
  {
    name: 'ismo',
    id: 'ghi789',
    videos_played: 0,
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
    'videos_played'
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
  const [player, setPlayer] = React.useState<YouTubePlayer | undefined>(undefined);
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
          onReady={(event) => {
            setPlayer(event.target);
          }}
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

function App() {
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
        {userStatuses.map((user) => {
          return (
            <C.Box key={user.id}>
              <C.Box key={user.id}>
                <C.Heading size="md">{user.name}</C.Heading>
              </C.Box>
              <C.Box key={user.videos_played}>
                <C.Heading size="md">Videos played: {user.videos_played}</C.Heading>
              </C.Box>
            </C.Box>
          );
        })}
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

export default App;
