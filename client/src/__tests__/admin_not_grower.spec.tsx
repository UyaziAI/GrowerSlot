import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminPage from '../pages/AdminPage';

describe('/admin renders Admin (not Grower)', () => {
  it('shows Admin header & grid and no grower booking controls', () => {
    render(<AdminPage />);
    
    expect(screen.getByTestId('admin-header-create')).toBeInTheDocument();
    expect(screen.getByTestId('admin-header-more')).toBeInTheDocument();
    expect(screen.getByTestId('admin-calendar-grid')).toBeInTheDocument();
    
    // sanity: grower-only affordances should NOT be in the page shell
    expect(screen.queryByText(/Book/i)).toBeNull();
    expect(screen.queryByText(/Next available/i)).toBeNull();
  });
});