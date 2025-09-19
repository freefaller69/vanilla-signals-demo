import { Signal, batch } from '../signals/signals_tc39.js';

// Sample data
const initialThreads = [
  {
    id: 1,
    name: 'Team Standup',
    participants: ['Alice', 'Bob', 'Charlie', 'You'],
    messages: [
      {
        id: 1,
        author: 'Alice',
        content: 'Good morning team! Ready for standup?',
        timestamp: Date.now() - 3600000,
        read: true,
      },
      {
        id: 2,
        author: 'Bob',
        content: 'Yes! I finished the API integration yesterday.',
        timestamp: Date.now() - 3500000,
        read: true,
      },
      {
        id: 3,
        author: 'Charlie',
        content: "Great work Bob! I'm working on the frontend components.",
        timestamp: Date.now() - 3400000,
        read: false,
      },
    ],
  },
  {
    id: 2,
    name: 'Project Alpha',
    participants: ['Sarah', 'Mike', 'You'],
    messages: [
      {
        id: 4,
        author: 'Sarah',
        content: 'The client loved the mockups! 🎉',
        timestamp: Date.now() - 7200000,
        read: true,
      },
      {
        id: 5,
        author: 'Mike',
        content: 'Awesome! When do we start development?',
        timestamp: Date.now() - 7100000,
        read: false,
      },
    ],
  },
  {
    id: 3,
    name: 'Design Review',
    participants: ['Emma', 'David', 'Lisa', 'You'],
    messages: [
      {
        id: 6,
        author: 'Emma',
        content: "I've uploaded the latest designs to Figma.",
        timestamp: Date.now() - 1200000,
        read: false,
      },
      {
        id: 7,
        author: 'David',
        content: 'The color palette looks much better now!',
        timestamp: Date.now() - 600000,
        read: false,
      },
    ],
  },
];

// SIGNALS - Core reactive state
export const threads = new Signal.State([...initialThreads]);
export const activeThreadId = new Signal.State(null);
export const messageInput = new Signal.State('');

// COMPUTED - Derived reactive values
export const activeThread = new Signal.Computed(() => {
  const threadId = activeThreadId.get();
  const allThreads = threads.get();
  if (!threadId) return null;
  const found = allThreads.find((t) => t.id === threadId);
  return found || null;
});

export const totalMessageCount = new Signal.Computed(() => {
  return threads.get().reduce((total, thread) => total + thread.messages.length, 0);
});

export const unreadCount = new Signal.Computed(() => {
  return threads.get().reduce((total, thread) => {
    return total + thread.messages.filter((msg) => !msg.read).length;
  }, 0);
});

export const totalThreadCount = new Signal.Computed(() => threads.get().length);

export const canSendMessage = new Signal.Computed(() => {
  const threadId = activeThreadId.get();
  const inputValue = messageInput.get();
  return threadId !== null && inputValue.trim().length > 0;
});

export const threadStats = new Signal.Computed(() => {
  return threads.get().map((thread) => ({
    ...thread,
    messageCount: thread.messages.length,
    unreadCount: thread.messages.filter((msg) => !msg.read).length,
    lastMessage: thread.messages[thread.messages.length - 1],
  }));
});

// ACTIONS - State mutations
export const selectThread = (threadId) => {
  batch(() => {
    activeThreadId.set(threadId);

    // Mark messages as read
    const currentThreads = threads.get();
    const updatedThreads = currentThreads.map((thread) => {
      if (thread.id === threadId) {
        return {
          ...thread,
          messages: thread.messages.map((msg) => ({ ...msg, read: true })),
        };
      }
      return thread;
    });
    threads.set(updatedThreads);
  });

  // Dispatch custom event
  window.dispatchEvent(
    new CustomEvent('threadSelected', {
      detail: { threadId },
    })
  );
};

export const sendMessage = (content) => {
  const threadId = activeThreadId.get();
  if (!threadId || !content.trim()) return;

  batch(() => {
    // Add message to thread
    const currentThreads = threads.get();
    const updatedThreads = currentThreads.map((thread) => {
      if (thread.id === threadId) {
        return {
          ...thread,
          messages: [
            ...thread.messages,
            {
              id: Date.now(),
              author: 'You',
              content: content.trim(),
              timestamp: Date.now(),
              read: true,
            },
          ],
        };
      }
      return thread;
    });

    threads.set(updatedThreads);
    messageInput.set('');
  });

  // Dispatch custom event
  window.dispatchEvent(
    new CustomEvent('messageSent', {
      detail: { threadId, content: content.trim() },
    })
  );

  // Simulate response after delay
  setTimeout(() => simulateResponse(threadId), 1000 + Math.random() * 2000);
};

export const createNewThread = () => {
  const threadNames = [
    'Quick Chat',
    'Random Discussion',
    'Work Sync',
    'Coffee Break',
    'Ideas & Feedback',
  ];
  const participants = ['Alex', 'Jordan', 'Taylor', 'Casey', 'Morgan'];

  const randomName = threadNames[Math.floor(Math.random() * threadNames.length)];
  const randomParticipant = participants[Math.floor(Math.random() * participants.length)];

  const newThread = {
    id: Date.now(),
    name: randomName,
    participants: [randomParticipant, 'You'],
    messages: [
      {
        id: Date.now(),
        author: randomParticipant,
        content: 'Hey! Just started this new thread. How are you doing?',
        timestamp: Date.now(),
        read: false,
      },
    ],
  };

  batch(() => {
    // Add new thread with messages already marked as read
    const newThreadWithReadMessages = {
      ...newThread,
      messages: newThread.messages.map((msg) => ({ ...msg, read: true })),
    };

    threads.set([...threads.get(), newThreadWithReadMessages]);
    activeThreadId.set(newThread.id);
  });

  return newThread.id;
};

// Helper function for simulating responses
const simulateResponse = (threadId) => {
  const responses = [
    "That's a great point!",
    'I agree with that approach.',
    'Let me check on that.',
    'Sounds good to me!',
    "I'll look into it.",
    'Thanks for the update!',
    "Perfect, let's move forward.",
    'I have some thoughts on that...',
    'Interesting perspective!',
    "Let's discuss this further.",
  ];

  const thread = threads.get().find((t) => t.id === threadId);
  if (!thread) return;

  const otherParticipants = thread.participants.filter((p) => p !== 'You');
  if (otherParticipants.length === 0) return;

  const randomParticipant = otherParticipants[Math.floor(Math.random() * otherParticipants.length)];
  const randomResponse = responses[Math.floor(Math.random() * responses.length)];

  const currentThreads = threads.get();
  const updatedThreads = currentThreads.map((t) => {
    if (t.id === threadId) {
      return {
        ...t,
        messages: [
          ...t.messages,
          {
            id: Date.now(),
            author: randomParticipant,
            content: randomResponse,
            timestamp: Date.now(),
            read: false,
          },
        ],
      };
    }
    return t;
  });

  threads.set(updatedThreads);
};

// Helper function for simulating movie quote responses
export const simulateMovieQuote = (threadId) => {
  const movieQuotes = [
    'May the Force be with you.',
    "I'll be back.",
    "Here's looking at you, kid.",
    'Show me the money!',
    "You can't handle the truth!",
    "Frankly, my dear, I don't give a damn.",
    'Life is like a box of chocolates.',
    'I feel the need... the need for speed!',
    'Nobody puts Baby in a corner.',
    'Say hello to my little friend!',
    'Houston, we have a problem.',
    'To infinity and beyond!',
    'Why so serious?',
    "I'm king of the world!",
    'You talking to me?',
    'Just keep swimming.',
    "There's no place like home.",
    'I see dead people.',
    'E.T. phone home.',
    'Great Scott!',
    'I am your father.',
    'Go ahead, make my day.',
    "I'm gonna make him an offer he can't refuse.",
    'Keep your friends close, but your enemies closer.',
    'Elementary, my dear Watson.',
    "Roads? Where we're going we don't need roads.",
    "Here's Johnny!",
    "You're gonna need a bigger boat.",
    "Frankly, Scarlett, I don't give a damn.",
    'After all, tomorrow is another day!',
    'I have always depended on the kindness of strangers.',
    "Toto, I've a feeling we're not in Kansas anymore.",
    'Round up the usual suspects.',
    "Play it, Sam. Play 'As Time Goes By.'",
    "We'll always have Paris.",
    'Of all the gin joints in all the towns in all the world, she walks into mine.',
    'Bond. James Bond.',
    'Shaken, not stirred.',
    "The name's Bond... James Bond.",
    'I love the smell of napalm in the morning.',
    "You can't handle the truth!",
    'Hasta la vista, baby.',
    'Come with me if you want to live.',
    "I'm not a smart man, but I know what love is.",
    'Mama always said life was like a box of chocolates.',
    'Run, Forrest, run!',
    'You had me at hello.',
    "Help me, I'm poor!",
    "I'm not bad. I'm just drawn that way.",
    'Carpe diem. Seize the day, boys. Make your lives extraordinary.',
    'Dead Poets Society',
    'Wax on, wax off.',
    'They may take our lives, but they’ll never take our freedom!',
    'There is no try, only do.',
    'Do or do not, there is no try.',
    "These aren't the droids you're looking for.",
    "That's no moon... it's a space station.",
    'I find your lack of faith disturbing.',
    'The Force will be with you... always.',
    "Help me, Obi-Wan Kenobi. You're my only hope.",
    'I love you. I know.',
    'Never tell me the odds!',
    "It's a trap!",
    'Welcome to the jungle!',
    "I'm too old for this.",
    'Just when I thought I was out, they pull me back in!',
    'Leave the gun, take the cannoli.',
    'Say hello to my little friend!',
    "In case I don't see ya, good afternoon, good evening, and good night!",
    "The truth? You can't handle the truth!",
    "Here's looking at you, kid.",
    "We're not in Kansas anymore.",
    "I'll get you, my pretty, and your little dog too!",
    'Pay no attention to that man behind the curtain.',
    "There's no crying in baseball!",
    'Houston, we have a problem.',
    'Failure is not an option.',
    'Life moves pretty fast.',
    'Bueller... Bueller...',
    'Anyone? Anyone?',
    'Save Ferris!',
    'Nobody puts Baby in a corner.',
    'I carried a watermelon.',
    'Time of my life.',
    'Inconceivable!',
    'Hello. My name is Inigo Montoya. You killed my father. Prepare to die.',
    'Have fun storming the castle!',
    'As you wish.',
    'True love is the greatest thing in the world.',
    'Mostly dead is slightly alive.',
    'My name is Maximus Decimus Meridius.',
    'Are you not entertained?',
    'Strength and honor.',
    'What we do in life echoes in eternity.',
    "I'm the king of the world!",
    'Draw me like one of your French girls.',
    "I'm flying, Jack!",
    "A woman's heart is a deep ocean of secrets.",
    'After all, tomorrow is another day!',
    'I do declare!',
    'Great balls of fire!',
    "You're killin' me, Smalls!",
    'Heroes get remembered, but legends never die.',
    'You play ball like a girl!',
    'Forever! Forever! Forever!',
    'P. Sherman, 42 Wallaby Way, Sydney.',
    'Just keep swimming, just keep swimming.',
    'Fish are friends, not food.',
    'I shall call him Squishy and he shall be mine.',
  ];

  const thread = threads.get().find((t) => t.id === threadId);
  if (!thread) return;

  const otherParticipants = thread.participants.filter((p) => p !== 'You');
  if (otherParticipants.length === 0) return;

  const randomParticipant = otherParticipants[Math.floor(Math.random() * otherParticipants.length)];
  const randomQuote = movieQuotes[Math.floor(Math.random() * movieQuotes.length)];

  const currentThreads = threads.get();
  const updatedThreads = currentThreads.map((t) => {
    if (t.id === threadId) {
      return {
        ...t,
        messages: [
          ...t.messages,
          {
            id: Date.now(),
            author: randomParticipant,
            content: randomQuote,
            timestamp: Date.now(),
            read: false,
          },
        ],
      };
    }
    return t;
  });

  threads.set(updatedThreads);
};

// Function to send a movie quote to a random thread
export const sendRandomMovieQuote = () => {
  const allThreads = threads.get();
  if (allThreads.length === 0) return;

  const randomThread = allThreads[Math.floor(Math.random() * allThreads.length)];
  simulateMovieQuote(randomThread.id);
};

// Auto-trigger random movie quotes at intervals
let movieQuoteInterval;

export const startRandomMovieQuotes = (minDelay = 5000, maxDelay = 15000) => {
  const scheduleNext = () => {
    const delay = minDelay + Math.random() * (maxDelay - minDelay);
    movieQuoteInterval = setTimeout(() => {
      sendRandomMovieQuote();
      scheduleNext();
    }, delay);
  };
  scheduleNext();
};

export const stopRandomMovieQuotes = () => {
  if (movieQuoteInterval) {
    clearTimeout(movieQuoteInterval);
    movieQuoteInterval = null;
  }
};
