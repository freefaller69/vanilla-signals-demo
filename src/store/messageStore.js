import { signal, computed, batch } from '../signals/signals.js';

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
export const threads = signal([...initialThreads]);
export const activeThreadId = signal(null);
export const messageInput = signal('');

// COMPUTED - Derived reactive values
export const activeThread = computed(() => {
  const threadId = activeThreadId.value;
  const allThreads = threads.value;
  console.log('activeThread computed - threadId:', threadId, 'threads count:', allThreads.length);
  if (!threadId) return null;
  const found = allThreads.find((t) => t.id === threadId);
  console.log('activeThread computed - found thread:', found?.name || 'null');
  return found || null;
});

export const totalMessageCount = computed(() => {
  return threads.value.reduce((total, thread) => total + thread.messages.length, 0);
});

export const unreadCount = computed(() => {
  return threads.value.reduce((total, thread) => {
    return total + thread.messages.filter((msg) => !msg.read).length;
  }, 0);
});

export const totalThreadCount = computed(() => threads.value.length);

export const canSendMessage = computed(() => {
  const threadId = activeThreadId.value;
  const inputValue = messageInput.value;
  return threadId !== null && inputValue.trim().length > 0;
});

export const threadStats = computed(() => {
  return threads.value.map((thread) => ({
    ...thread,
    messageCount: thread.messages.length,
    unreadCount: thread.messages.filter((msg) => !msg.read).length,
    lastMessage: thread.messages[thread.messages.length - 1],
  }));
});

// ACTIONS - State mutations
export const selectThread = (threadId) => {
  console.log('selectThread called with threadId:', threadId);
  batch(() => {
    console.log('Setting activeThreadId to:', threadId);
    activeThreadId.value = threadId;
    console.log('activeThreadId is now:', activeThreadId.value);

    // Mark messages as read
    const currentThreads = threads.value;
    const updatedThreads = currentThreads.map((thread) => {
      if (thread.id === threadId) {
        return {
          ...thread,
          messages: thread.messages.map((msg) => ({ ...msg, read: true })),
        };
      }
      return thread;
    });
    threads.value = updatedThreads;
  });

  // Dispatch custom event
  window.dispatchEvent(
    new CustomEvent('threadSelected', {
      detail: { threadId },
    })
  );
};

export const sendMessage = (content) => {
  console.log('sendMessage: content');
  const threadId = activeThreadId.value;
  if (!threadId || !content.trim()) return;

  batch(() => {
    // Add message to thread
    const currentThreads = threads.value;
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

    threads.value = updatedThreads;
    messageInput.value = '';
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

    threads([...threads.value, newThreadWithReadMessages]);
    activeThreadId(newThread.id);
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

  const thread = threads.value.find((t) => t.id === threadId);
  if (!thread) return;

  const otherParticipants = thread.participants.filter((p) => p !== 'You');
  if (otherParticipants.length === 0) return;

  const randomParticipant = otherParticipants[Math.floor(Math.random() * otherParticipants.length)];
  const randomResponse = responses[Math.floor(Math.random() * responses.length)];

  const currentThreads = threads.value;
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

  threads.value = updatedThreads;
};
