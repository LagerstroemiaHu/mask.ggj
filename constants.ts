
import { LevelConfig } from './types';

export const COLORS = {
  background: '#0a0a0a',
  foreground: '#fafafa',
  accent: '#ef4444', // Red for Authority/Teacher
  muted: '#525252',
  shapes: [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
  ]
};

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    title: "The Classroom",
    description: "规训与抵抗。不要停止自我表达。",
    locked: false,
  },
  {
    id: 2,
    title: "The Factory",
    description: "流水线上的标准化。逆流而上。",
    locked: false,
  },
  {
    id: 3,
    title: "The Capital",
    description: "积累与异化。价值的单向流动。",
    locked: false,
  },
  {
    id: 4,
    title: "The Mall",
    description: "消费主义陷阱。购买不是自由。",
    locked: false,
  },
  {
    id: 5,
    title: "The Epiphany",
    description: "向左走。不要回头。",
    locked: false,
  }
];
