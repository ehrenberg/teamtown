import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusDot, type PresenceStatus } from './status-dot.tsx';

describe('StatusDot', () => {
  it('exposes the status to assistive technology', () => {
    render(<StatusDot status="focus" label="Focus" />);

    expect(screen.getByRole('img', { name: 'Focus' }).dataset.status).toBe('focus');
  });

  it.each<PresenceStatus>(['busy', 'away', 'offline'])('distinguishes "%s" by shape, not only by colour', (status) => {
    render(<StatusDot status={status} label={status} />);

    expect(screen.getByRole('img', { name: status }).className).toMatch(/after:|border-2/);
  });
});
