import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UserContests from '../pages/UserContests';
import { authAPI, contestsAPI } from '../services/api';

vi.mock('../services/api', () => ({
  contestsAPI: {
    getAll: vi.fn(),
    join: vi.fn(),
  },
  authAPI: {
    getMe: vi.fn(),
  },
}));

describe('UserContests quick actions', () => {
  beforeEach(() => {
    (contestsAPI.getAll as any).mockResolvedValue([]);
    (authAPI.getMe as any).mockRejectedValue(new Error('Not logged in'));
  });

  it('shows Practice Coding and Practice MCQ buttons', async () => {
    render(
      <MemoryRouter>
        <UserContests />
      </MemoryRouter>
    );

    expect(await screen.findByText('Contests')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Practice Coding/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Practice MCQ/i })).toBeInTheDocument();
  });
});
