import axios from 'axios';
import {
  AuthResponse,
  ContestSummary,
  ContestDetail,
  QuestionDetail,
  SigninRequest,
  CreateContestRequest,
  CreateQuestionRequest,
} from '../types';

const API_BASE_URL = 'http://localhost:3000'; // Adjust as needed

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add JWT token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authAPI = {
  signin: async (data: SigninRequest): Promise<AuthResponse> => {
    const response = await api.post('/auth/signin', data);
    return response.data;
  },

  signup: async (data: { name: string; email: string; password: string }): Promise<AuthResponse> => {
    const response = await api.post('/auth/signup', data);
    return response.data;
  },
};

// Contests API
export const contestsAPI = {
  getAll: async (): Promise<ContestSummary[]> => {
    const response = await api.get('/contests');
    return response.data;
  },

  create: async (data: CreateContestRequest): Promise<ContestSummary> => {
    const response = await api.post('/contests', data);
    return response.data;
  },

  getById: async (id: string): Promise<ContestDetail> => {
    const response = await api.get(`/contest/${id}`);
    return response.data;
  },

  join: async (contestId: string): Promise<{ message: string }> => {
    const response = await api.post(`/contest/${contestId}/join`);
    return response.data;
  },
};

// Questions API
export const questionsAPI = {
  getAll: async (contestId: string): Promise<QuestionDetail[]> => {
    const response = await api.get(`/contests/${contestId}/questions`);
    return response.data;
  },

  create: async (contestId: string, data: CreateQuestionRequest): Promise<QuestionDetail> => {
    const response = await api.post(`/contests/${contestId}/questions`, data);
    return response.data;
  },
};