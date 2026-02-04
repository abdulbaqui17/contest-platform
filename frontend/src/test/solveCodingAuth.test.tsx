import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SolveCoding from '../pages/SolveCoding';
import { authAPI, questionsAPI } from '../services/api';

vi.mock('../services/api', () => ({
  questionsAPI: {
    getById: vi.fn(),
    getTestCases: vi.fn(),
  },
  submissionsAPI: {
    runCode: vi.fn(),
    submitPractice: vi.fn(),
  },
  authAPI: {
    getMe: vi.fn(),
  },
}));

describe('SolveCoding auth gate', () => {
  beforeEach(() => {
    localStorage.clear();
    (questionsAPI.getById as any).mockResolvedValue({
      id: 'q1',
      title: 'Two Sum',
      description: 'Return indices',
      type: 'CODING',
      timeLimit: 2000,
      memoryLimit: 256,
    });
    (questionsAPI.getTestCases as any).mockResolvedValue({ testCases: [] });
    (authAPI.getMe as any).mockRejectedValue(new Error('Not logged in'));
  });

  it('disables submit and shows sign-in CTA when logged out', async () => {
    render(
      <MemoryRouter initialEntries={['/practice/coding/q1']}>
        <Routes>
          <Route path="/practice/coding/:id" element={<SolveCoding />} />
        </Routes>
      </MemoryRouter>
    );

    const titles = await screen.findAllByText('Two Sum');
    expect(titles.length).toBeGreaterThan(0);
    expect(screen.getByText(/Sign in to submit/i)).toBeInTheDocument();

    const submitButton = screen.getByRole('button', { name: /submit/i });
    expect(submitButton).toBeDisabled();
  });
});
