import React from 'react';
import { Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import { DeleteIcon, CopyIcon } from '@chakra-ui/icons';
import useSWR, { KeyedMutator } from 'swr';
import _ from 'lodash';
import YouTube from 'react-youtube';
import * as C from '@chakra-ui/react';
import QRCode from 'react-qr-code';
import {
  createRoom,
  createUser,
  getUsersForOwner,
  getVideoQueueForUser,
  updateUserVideoQueue,
  getVideoTitleFromId,
} from './callApi';
import { Logo } from './logo';

const opts = {
  width: 250,
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

async function getVideoTitle([path, id]: [string, string]) {
  return await getVideoTitleFromId(id);
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
    return (
      <C.Center>
        <C.Stack>
          <C.Box width={200}>
            <Logo />
          </C.Box>
          {userStatuses.length > 0 && <C.Box pt={4}>No videos in queue found :(</C.Box>}
        </C.Stack>
      </C.Center>
    );
  }

  if (currentlyPlaying?.videoId) {
    const currentName = userStatuses.find((user) => user.id === currentlyPlaying.userId)?.name;
    const nextName = userStatuses.find((user) => user.id === nextVideo?.userId)?.name;
    return (
      <C.Stack spacing={8}>
        <C.Box>
          <C.Center>
            <C.Box maxWidth="100%">
              <YouTube
                opts={opts}
                videoId={currentlyPlaying?.videoId}
                onEnd={async () => {
                  const nextVideo = getNextVideo({ userStatuses, lastPlayedTimestamps });
                  if (nextVideo) {
                    await updateUserVideoQueue({
                      id: nextVideo.userId,
                      video_queue:
                        userStatuses
                          .find((user) => user.id === nextVideo.userId)
                          ?.video_queue.slice(1) || [],
                    });
                    setCurrentlyPlaying(nextVideo);
                    setLastPlayedTimestamps({
                      ...lastPlayedTimestamps,
                      [nextVideo.userId]: Date.now(),
                    });
                  } else {
                    setCurrentlyPlaying(null);
                  }
                  mutateUserStatuses();
                }}
              />
            </C.Box>
          </C.Center>
        </C.Box>
        {currentName && (
          <C.Flex p={4} backgroundColor="#ecf5da" borderRadius={8}>
            <C.Stack spacing={8} ml="3">
              <C.Box>
                <C.Text>Now playing:</C.Text>
                <C.Text fontWeight="bold">
                  <VideoTitle id={currentlyPlaying.videoId} />
                </C.Text>
              </C.Box>
              <C.HStack>
                <C.Text>From: </C.Text>
                <C.Badge ml="1" colorScheme="blue">
                  <C.Text fontWeight="bold">{currentName}</C.Text>
                </C.Badge>
              </C.HStack>
              <C.HStack>
                <C.Text>Next up: </C.Text>
                <C.Badge ml="1" colorScheme="yellow">
                  <C.Text fontWeight="bold">{nextName ? nextName : 'Nobody in queue!'}</C.Text>
                </C.Badge>
              </C.HStack>
            </C.Stack>
          </C.Flex>
        )}
      </C.Stack>
    );
  }

  return <C.Center>No videos in queue found</C.Center>;
}

function UserItem({ name, id, video_queue }: { name: string; id: string; video_queue: string[] }) {
  const { onCopy } = C.useClipboard(`https://levyraati.xyz/user/${id}`);
  return (
    <C.Flex backgroundColor="#FFE7AF" p={4} borderRadius="10px">
      <C.Center>
        <QRCode value={`https://levyraati.xyz/user/${id}`} size={96} />
      </C.Center>
      <C.Stack ml={8} spacing={4}>
        <C.Text fontWeight="bold">
          {name}
          <C.Badge ml="2" colorScheme={video_queue.length ? 'green' : 'purple'}>
            {video_queue.length ? 'Active' : 'No videos in queue'}
          </C.Badge>
        </C.Text>
        <C.Heading>
          <C.Center>
            <C.Link
              target="_blank"
              href={`https://levyraati.xyz/user/${id}`}
              fontSize="xs">{`https://levyraati.xyz/user/${id}`}</C.Link>
          </C.Center>
        </C.Heading>
        <C.IconButton
          size="xs"
          width={16}
          bg="purple.100"
          aria-label="Copy URL"
          icon={<CopyIcon />}
          onClick={onCopy}
        />
      </C.Stack>
    </C.Flex>
  );
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
    <C.Stack spacing={16} p={4}>
      <C.Box width="100%">
        <C.Center>
          <C.Heading width="100%">
            <C.Center>Let's go</C.Center>
          </C.Heading>
        </C.Center>
      </C.Box>

      <C.Box>
        <YoutubePage userStatuses={userStatuses} mutateUserStatuses={mutateUserStatuses} />
      </C.Box>

      <C.Stack spacing={8}>
        <C.Box>
          {userStatuses.length > 0 ? (
            <C.Stack spacing={8} mt={4}>
              {userStatuses.map((user) => (
                <UserItem key={id} {...user} />
              ))}
            </C.Stack>
          ) : (
            <C.Center>Add users below to get started!</C.Center>
          )}
        </C.Box>

        <AddUser
          onAddUser={async (name: string) => {
            await createUser({ name, ownerId: id });
            const users = await getUsersForOwner(id);
            mutateUserStatuses(users, false);
          }}
        />
      </C.Stack>
    </C.Stack>
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
        <C.HStack>
          <C.Input
            id="name"
            placeholder="Enter new user name"
            name="name"
            type="text"
            onChange={formik.handleChange}
            value={formik.values.name}
          />
          <C.Button type="submit">
            <C.Text fontSize="xs">Add user</C.Text>
          </C.Button>
        </C.HStack>
      </form>
    </C.Box>
  );
}

function VideoTitle({ id }: { id: string }) {
  const { data: title } = useSWR(['/video-id', id], getVideoTitle);
  if (title) {
    return <C.Box>{title}</C.Box>;
  }
  return null;
}

function RoomForUser() {
  const { id } = useParams<{ id: string }>();
  const {
    data: videoQueue,
    isLoading,
    mutate: mutateVideoQueue,
  } = useSWR(['/video-queue/user_statuses', id], getVideoQueue, { refreshInterval: 5000 });

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
    onSubmit: async (values, actions) => {
      const videoIdMatch = values.videoIdOrUrl.match(/([a-zA-Z0-9_-]{11})/);
      const [videoId] = videoIdMatch || [];
      if (videoQueue && id && videoId) {
        await mutateVideoQueue();
        const newQueue = [...videoQueue, videoId];
        await updateUserVideoQueue({ id, video_queue: newQueue });
        mutateVideoQueue(newQueue);
      }
      actions.resetForm();
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
            placeholder="Insert YouTube URL"
            onChange={formik.handleChange}
            value={formik.values.videoIdOrUrl}
          />
          {formik.errors.videoIdOrUrl ? (
            <C.Text color="red">{formik.errors.videoIdOrUrl}</C.Text>
          ) : null}
          <C.Button disabled={isLoading} type="submit" size="md">
            <C.Text fontSize="xs">Add video</C.Text>
          </C.Button>
        </C.HStack>
      </form>
      {videoQueue.map((videoId, index) => (
        <C.Flex key={videoId} backgroundColor="#FFE7AF" p={4} borderRadius="10px">
          <C.Center></C.Center>
          <C.Stack spacing={4} ml="3">
            <C.Text>
              {videoId}
              <C.Badge ml="2" colorScheme={index === 0 ? 'green' : 'purple'}>
                <C.Text fontSize="xs">{index === 0 ? 'Your next video' : 'Queued'}</C.Text>
              </C.Badge>
            </C.Text>
            <C.Text fontWeight="bold">
              <VideoTitle id={videoId} />
            </C.Text>
            <C.Link
              target="_blank"
              href={`https://youtube.com/videos/${videoId}`}
              fontSize="xs">{`https://youtube.com/videos/${videoId}`}</C.Link>
            <C.Button
              onClick={async () => {
                await mutateVideoQueue();
                const newQueue = videoQueue.filter((id) => id !== videoId);
                await updateUserVideoQueue({ id, video_queue: newQueue });
                mutateVideoQueue(newQueue);
              }}>
              <DeleteIcon />
            </C.Button>
          </C.Stack>
        </C.Flex>
      ))}
    </C.Stack>
  );
}

function Footer() {
  return (
    <C.Container as="footer" role="contentinfo" pt={12}>
      <C.Center>
        <C.Stack>
          <C.Box w={120}>
            <C.Link href="https://levyraati.xyz">
              <Logo />
            </C.Link>
            <C.Center>
              <C.Text fontSize="sm" mt={2} pb={8} fontWeight="bold" color="fg.subtle">
                2023
              </C.Text>
            </C.Center>
          </C.Box>
        </C.Stack>
      </C.Center>
    </C.Container>
  );
}

function Instructions() {
  const { isOpen, onOpen, onClose } = C.useDisclosure();
  return (
    <>
      <C.Button colorScheme="pink" onClick={onOpen}>
        Instructions
      </C.Button>

      <C.Modal isOpen={isOpen} onClose={onClose}>
        <C.ModalOverlay />
        <C.ModalContent>
          <C.ModalHeader>Youtube scheduler app</C.ModalHeader>
          <C.ModalCloseButton />
          <C.ModalBody>
            This app functions as a centralized Youtube video queue. <br />
            <br />
            You can add users, and give each user a link that they can use on their own device to
            queue videos. The device where this app runs on will then play videos from the users one
            by one.
            <br />
            <br /> Click the button in the main page to create a room an get started!
          </C.ModalBody>

          <C.ModalFooter>
            <C.Button colorScheme="blue" mr={3} onClick={onClose}>
              Close
            </C.Button>
          </C.ModalFooter>
        </C.ModalContent>
      </C.Modal>
    </>
  );
}

function LandingPage() {
  const navigate = useNavigate();
  return (
    <C.Center>
      <C.Stack spacing={12}>
        <C.Center>
          <C.Heading>Welcome</C.Heading>
        </C.Center>
        <C.Button
          colorScheme="purple"
          onClick={async () => {
            const { id } = await createRoom();
            navigate(`/room/${id}`);
          }}>
          Click here to create a room
        </C.Button>
        <C.Center>
          <C.Box width="50%">
            <C.Center>
              <Instructions />
            </C.Center>
          </C.Box>
        </C.Center>
      </C.Stack>
    </C.Center>
  );
}

function MainContainer({ children }: { children: string | JSX.Element | JSX.Element[] }) {
  return (
    <C.Container pt={20} as="main">
      {children}
      <Footer />
    </C.Container>
  );
}

function App() {
  return (
    <C.Box backgroundColor="#FFFAE8">
      <MainContainer>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/room/:id" element={<RoomForOwner />} />
          <Route path="/user/:id" element={<RoomForUser />} />
        </Routes>
      </MainContainer>
    </C.Box>
  );
}

export default App;
