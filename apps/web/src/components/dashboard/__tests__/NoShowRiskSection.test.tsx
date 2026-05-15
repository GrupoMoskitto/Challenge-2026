import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NoShowRiskSection, AppointmentShort } from '../NoShowRiskSection';
import '@testing-library/jest-dom';

const mockAppointments: AppointmentShort[] = [
  { id: '1', riskScore: 90 },
  { id: '2', riskScore: 40 },
  { id: '3', riskScore: 65 }
];

describe('NoShowRiskSection', () => {
  it('renders the compact score card', () => {
    render(<NoShowRiskSection appointments={mockAppointments} />);
    expect(screen.getByText('Score do Hospital')).toBeInTheDocument();
    expect(screen.getByText(/65/)).toBeInTheDocument();
  });

  it('calculates average score correctly', () => {
    render(<NoShowRiskSection appointments={mockAppointments} />);
    // (90 + 40 + 65) / 3 = 65
    expect(screen.getByText(/65/)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    const { container } = render(<NoShowRiskSection appointments={[]} isLoading={true} />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows error state with retry', () => {
    const onRetry = vi.fn();
    render(<NoShowRiskSection appointments={[]} error={new Error('Fail')} onRetry={onRetry} />);
    expect(screen.getByText(/Erro/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Tentar/i));
    expect(onRetry).toHaveBeenCalled();
  });

  it('contains correctly labeled gauge elements', () => {
    render(<NoShowRiskSection appointments={mockAppointments} />);
    expect(screen.getByText(/Crítico/i)).toBeInTheDocument();
    expect(screen.getByText(/Excelente/i)).toBeInTheDocument();
  });
});
