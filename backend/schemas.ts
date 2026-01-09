import { z } from 'zod';

// Auth Schemas
export const SignupRequestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export const SigninRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

export const UserResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['ADMIN', 'USER']),
  createdAt: z.string()
});

export const AuthResponseSchema = z.object({
  message: z.string(),
  user: UserResponseSchema,
  token: z.string()
});

// Contest Schemas
export const ContestSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  status: z.enum(['DRAFT', 'UPCOMING', 'ACTIVE', 'COMPLETED'])
});

export const ContestDetailSchema = ContestSummarySchema.extend({
  questions: z.array(z.object({
    id: z.string(),
    title: z.string(),
    orderIndex: z.number(),
    points: z.number(),
    timeLimit: z.number()
  }))
});

export const JoinResponseSchema = z.object({
  message: z.string()
});

// Contest Runtime Schemas
export const CurrentQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(['MCQ', 'DSA', 'SANDBOX']),
  title: z.string(),
  description: z.string(),
  mcqOptions: z.array(z.object({
    id: z.string(),
    text: z.string()
  })).optional(),
  timeLimit: z.number(),
  points: z.number()
});

export const SubmitRequestSchema = z.object({
  questionId: z.string(),
  selectedOptionId: z.string().optional()
});

export const SubmitResponseSchema = z.object({
  isCorrect: z.boolean(),
  points: z.number()
});

// Leaderboard Schemas
export const LeaderboardEntrySchema = z.object({
  rank: z.number(),
  user: z.object({
    id: z.string(),
    name: z.string()
  }),
  score: z.number()
});

export const LeaderboardSchema = z.array(LeaderboardEntrySchema);

export const MyEntrySchema = LeaderboardEntrySchema;

// Error Schema
export const ErrorResponseSchema = z.object({
  error: z.string()
});

// Type exports
export type SignupRequest = z.infer<typeof SignupRequestSchema>;
export type SigninRequest = z.infer<typeof SigninRequestSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type ContestSummary = z.infer<typeof ContestSummarySchema>;
export type ContestDetail = z.infer<typeof ContestDetailSchema>;
export type JoinResponse = z.infer<typeof JoinResponseSchema>;
export type CurrentQuestion = z.infer<typeof CurrentQuestionSchema>;
export type SubmitRequest = z.infer<typeof SubmitRequestSchema>;
export type SubmitResponse = z.infer<typeof SubmitResponseSchema>;
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;
export type Leaderboard = z.infer<typeof LeaderboardSchema>;
export type MyEntry = z.infer<typeof MyEntrySchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;