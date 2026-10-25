import { ChoiceNode, LineNode, Transcript, TranscriptTranslation } from '../models/transcript.models';
const responseQuestion: LineNode = {
  type: 'line',
  id: 'response-question',
  text: 'How do you respond?',
};
const response: ChoiceNode = {
  type: 'choice',
  id: 'response',
  options: [
    {
      id: 'truth',
      label: 'Tell the truth',
      nodes: [
        { type: 'line', id: 'truth-line', speaker: 'Mira', text: 'Then we face it together.' },
        { type: 'line', id: 'promise-question', text: 'Will you make a promise?' },
        {
          type: 'choice',
          id: 'promise',
          options: [
            {
              id: 'yes',
              label: 'I promise.',
              nodes: [{ type: 'line', id: 'yes-line', speaker: 'You', text: 'I will not run.' }],
            },
            {
              id: 'no',
              label: 'I cannot promise that.',
              nodes: [
                { type: 'line', id: 'no-line', speaker: 'Mira', text: 'At least you are honest.' },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'dodge',
      label: 'Change the subject',
      nodes: [
        {
          type: 'line',
          id: 'dodge-line',
          speaker: 'Mira',
          text: 'You always do that when it matters.',
        },
      ],
    },
  ],
};
export const TRANSCRIPTS: Transcript[] = [
  {
    id: 'arrival',
    title: 'The First Signal',
    category: 'main-story',
    parentId: 'chapter-1',
    parentLabel: 'Chapter 1 · The Awakening',
    stageLabel: 'Stage 1 · Arrival',
    description: 'A quiet signal draws the crew into the ruins.',
    nodes: [
      {
        type: 'line',
        id: 'a1',
        speaker: 'Mira',
        text: 'You made it. I was beginning to worry.',
        variants: {
          male: 'You made it, brother. I was beginning to worry.',
          female: 'You made it, sister. I was beginning to worry.',
        },
      },
      { type: 'line', id: 'a2', description: 'Rain ticks against the broken observatory glass.' },
      responseQuestion,
      response,
      {
        type: 'line',
        id: 'a3',
        speaker: 'Archivist',
        text: 'The signal is still alive beneath us.',
      },
    ],
  },
  {
    id: 'departure',
    title: 'Leaving Orbit',
    category: 'main-story',
    parentId: 'chapter-1',
    parentLabel: 'Chapter 1 · The Awakening',
    stageLabel: 'Stage 2 · Departure',
    description: 'The ship leaves orbit with one last question unanswered.',
    nodes: [
      { type: 'line', id: 'd1', speaker: 'Pilot', text: 'All systems green. We have one window.' },
      { type: 'line', id: 'd2', speaker: 'You', text: 'Then take it.' },
    ],
  },
  {
    id: 'festival',
    title: 'Lantern Festival',
    category: 'event-story',
    parentId: 'festival-night',
    parentLabel: 'Lantern Festival',
    stageLabel: 'Stage 1 · The Square',
    description: 'A brief celebration before the next journey.',
    nodes: [
      {
        type: 'line',
        id: 'f1',
        speaker: 'Mira',
        text: 'For one night, there are no ruins. Only lights.',
      },
      { type: 'line', id: 'f2', description: 'Lanterns rise over the square like a second sky.' },
    ],
  },
  {
    id: 'interview',
    title: 'The First Interview',
    category: 'interrogation',
    parentId: 'mira',
    parentLabel: 'Mira',
    stageLabel: 'Part 1 · The Signal',
    description: 'Mira answers questions about the signal.',
    nodes: [
      { type: 'line', id: 'i1', speaker: 'Detective', text: 'When did you first hear it?' },
      { type: 'line', id: 'i2', speaker: 'Mira', text: 'Three nights ago. It used your name.' },
    ],
  },

  {
    id: 'archive-dive',
    title: 'The Archive Below',
    category: 'main-story',
    parentId: 'chapter-2',
    parentLabel: 'Chapter 2 · Below the Glass',
    stageLabel: 'Stage 1 · The Descent',
    description: 'The crew follows the signal beneath the flooded district.',
    nodes: [
      {
        type: 'line',
        id: 'ad1',
        speaker: 'Mira',
        text: 'The water is rising. We have minutes.',
        variants: {
          male: 'The water is rising, brother. We have minutes.',
          female: 'The water is rising, sister. We have minutes.',
        },
      },
      {
        type: 'line',
        id: 'ad2',
        speaker: 'Archivist',
        text: 'The archive sealed itself from the inside.',
      },
      { type: 'line', id: 'ad-question', text: 'Which path should the crew take?' },
      {
        type: 'choice',
        id: 'ad-choice',
        options: [
          {
            id: 'tunnel',
            label: 'The service tunnel',
            nodes: [
              {
                type: 'line',
                id: 'ad-tunnel',
                description: 'A low mechanical hum follows you into the dark.',
              },
              { type: 'line', id: 'ad-tunnel-line', speaker: 'Pilot', text: 'I found a door.' },
            ],
          },
          {
            id: 'stairs',
            label: 'The old stairwell',
            nodes: [
              {
                type: 'line',
                id: 'ad-stairs',
                description: 'The stairs descend farther than the building should allow.',
              },
              {
                type: 'line',
                id: 'ad-stairs-line',
                speaker: 'Mira',
                text: 'Something is waiting below.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'blackout',
    title: 'City Without Stars',
    category: 'main-story',
    parentId: 'chapter-2',
    parentLabel: 'Chapter 2 · Below the Glass',
    stageLabel: 'Stage 2 · Blackout',
    description: 'The city loses power as the signal reaches its peak.',
    nodes: [
      { type: 'line', id: 'bo1', speaker: 'Pilot', text: 'Every light just went out.' },
      { type: 'line', id: 'bo2', speaker: 'You', text: 'Then we navigate by memory.' },
    ],
  },
  {
    id: 'midnight-market',
    title: 'The Midnight Market',
    category: 'event-story',
    parentId: 'night-market',
    parentLabel: 'Midnight Market',
    stageLabel: 'Stage 1 · Last Vendor',
    description: 'A vendor offers a map that should not exist.',
    nodes: [
      {
        type: 'line',
        id: 'mm1',
        speaker: 'Vendor',
        text: 'I kept this for someone who asked the right question.',
      },
      { type: 'line', id: 'mm-question', text: 'What do you offer in return?' },
      {
        type: 'choice',
        id: 'mm-choice',
        options: [
          {
            id: 'coin',
            label: 'A memory token',
            nodes: [
              {
                type: 'line',
                id: 'mm-coin',
                speaker: 'Vendor',
                text: 'A fair price. Take the map.',
              },
            ],
          },
          {
            id: 'secret',
            label: 'A secret',
            nodes: [
              {
                type: 'line',
                id: 'mm-secret',
                speaker: 'Vendor',
                text: 'Keep your voice down. The walls listen.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'quiet-day',
    title: 'A Quiet Day',
    category: 'event-story',
    parentId: 'festival-night',
    parentLabel: 'Lantern Festival',
    stageLabel: 'Stage 2 · Morning After',
    description: 'The square is empty, but one lantern remains lit.',
    nodes: [
      { type: 'line', id: 'qd1', speaker: 'Mira', text: 'Some lights refuse to go out.' },
      { type: 'line', id: 'qd2', description: 'You fold the last paper lantern and keep walking.' },
    ],
  },
  {
    id: 'pilot-interview',
    title: 'The Pilot Remembers',
    category: 'interrogation',
    parentId: 'pilot',
    parentLabel: 'Pilot',
    stageLabel: 'Part 1 · The Flight',
    description: 'The pilot recounts the first time the ship changed course.',
    nodes: [
      { type: 'line', id: 'pi1', speaker: 'Detective', text: 'Who gave the order to turn?' },
      { type: 'line', id: 'pi2', speaker: 'Pilot', text: 'No one. The ship chose.' },
      { type: 'line', id: 'pi-question', text: 'Do you press the pilot?' },
      {
        type: 'choice',
        id: 'pi-choice',
        options: [
          {
            id: 'press',
            label: 'Ask again',
            nodes: [
              {
                type: 'line',
                id: 'pi-press',
                speaker: 'Pilot',
                text: 'You heard me. The ship chose.',
              },
            ],
          },
          {
            id: 'release',
            label: 'End the interview',
            nodes: [
              {
                type: 'line',
                id: 'pi-release',
                speaker: 'Detective',
                text: 'We will continue tomorrow.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'archivist-interview',
    title: 'The Archivist’s Oath',
    category: 'interrogation',
    parentId: 'archivist',
    parentLabel: 'Archivist',
    stageLabel: 'Part 1 · The Oath',
    description: 'An old oath explains why the archive was hidden.',
    nodes: [
      { type: 'line', id: 'ai1', speaker: 'Detective', text: 'What are you protecting?' },
      {
        type: 'line',
        id: 'ai2',
        speaker: 'Archivist',
        text: 'The version of the world that survived.',
      },
    ],
  },

  {
    id: 'before-and-after',
    title: 'The Door Remembers',
    category: 'main-story',
    parentId: 'chapter-2',
    parentLabel: 'Chapter 2 · Below the Glass',
    stageLabel: 'Stage 3 · The Memory Door',
    description: 'The crew reaches a door that records every visitor.',
    nodes: [
      { type: 'line', id: 'baa1', speaker: 'Mira', text: 'The corridor ends here.' },
      { type: 'line', id: 'baa2', description: 'A thin blue seam pulses beneath the door.' },
      {
        type: 'line',
        id: 'baa3',
        speaker: 'Archivist',
        text: 'Listen. It is replaying our footsteps.',
      },
      { type: 'line', id: 'baa-question', text: 'How do you open the memory door?' },
      {
        type: 'choice',
        id: 'baa-choice',
        options: [
          {
            id: 'touch',
            label: 'Place your hand on it',
            nodes: [
              {
                type: 'line',
                id: 'baa-touch',
                speaker: 'Door',
                text: 'The archive recognizes you.',
              },
            ],
          },
          {
            id: 'speak',
            label: 'Speak the signal aloud',
            nodes: [
              {
                type: 'line',
                id: 'baa-speak',
                speaker: 'Door',
                text: 'The archive answers in kind.',
              },
            ],
          },
        ],
      },
      { type: 'line', id: 'baa4', speaker: 'Mira', text: 'The lock is open.' },
      {
        type: 'line',
        id: 'baa5',
        description: 'Beyond it, the first recorded sunrise waits in silence.',
      },
      {
        type: 'line',
        id: 'baa6',
        speaker: 'Archivist',
        text: 'Whatever we find, we leave a record behind.',
      },
    ],
  },
  {
    id: 'perspectra-signal',
    title: 'The Signal From Her Side',
    category: 'perspectra',
    parentId: 'perspectra-chapter-1',
    parentLabel: 'Chapter 1 · The Witness',
    stageLabel: 'Stage 1 · A Different Angle',
    description: 'The same signal, remembered from another point of view.',
    nodes: [
      { type: 'line', id: 'ps1', speaker: 'Mira', text: 'From here, the signal sounds almost like a voice.' },
      { type: 'line', id: 'ps2', description: 'The observatory lights flicker in a pattern only she notices.' },
      { type: 'line', id: 'ps3', speaker: 'Mira', text: 'You heard it too. Now you know what it wants.' },
    ],
  },
];

// Example Vietnamese content. Missing node translations intentionally fall back to English.
const vietnameseExamples: Record<string, TranscriptTranslation> = {
  arrival: {
    title: 'Tín hiệu đầu tiên',
    parentLabel: 'Chương 1 · Thức tỉnh',
    stageLabel: 'Màn 1 · Đến nơi',
    description: 'Một tín hiệu yên lặng dẫn thủy thủ đoàn đến khu phế tích.',
    nodes: [
      { type: 'line', id: 'a1', speaker: 'Mira', text: 'Bạn đã đến rồi. Tôi bắt đầu lo lắng đấy.' },
      { type: 'line', id: 'a2', description: 'Mưa rơi lộp bộp trên những ô kính vỡ của đài quan sát.' },
      responseQuestion,
      response,
      { type: 'line', id: 'a3', speaker: 'Thủ thư', text: 'Tín hiệu vẫn còn sống bên dưới chúng ta.' },
    ],
  },
  departure: {
    title: 'Rời quỹ đạo',
    parentLabel: 'Chương 1 · Thức tỉnh',
    stageLabel: 'Màn 2 · Khởi hành',
    description: 'Con tàu rời quỹ đạo với một câu hỏi cuối cùng chưa có lời đáp.',
  },
  festival: {
    title: 'Lễ hội đèn lồng',
    parentLabel: 'Lễ hội đèn lồng',
    stageLabel: 'Màn 1 · Quảng trường',
    description: 'Một khoảnh khắc vui mừng ngắn ngủi trước hành trình tiếp theo.',
  },
};

for (const transcript of TRANSCRIPTS) {
  const translation = vietnameseExamples[transcript.id];
  if (translation) transcript.translations = { vi: translation };
}
