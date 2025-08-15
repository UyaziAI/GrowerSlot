import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AppShell from '../components/AppShell';

describe('AppShell header', () => {
  it('shows brand, nav links, and logout', () => {
    render(<AppShell><div>child</div></AppShell>);
    expect(screen.getByText('GrowerSlot')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Grower')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });
});