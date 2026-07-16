import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DandelionMark } from '@renderer/components/brand/DandelionMark';
import { Favicon } from '@renderer/components/ui/Favicon';
import { Kbd } from '@renderer/components/ui/Kbd';

describe('brand + ui primitives', () => {
  it('renders the Dandelion logo as an SVG', () => {
    const { container } = render(<DandelionMark className="h-4 w-4" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('falls back to a glyph when a favicon is missing', () => {
    const { container } = render(<Favicon src={null} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders an image when a favicon src is provided', () => {
    const { container } = render(<Favicon src="https://example.com/favicon.ico" />);
    expect(container.querySelector('img')).not.toBeNull();
  });

  it('renders keyboard hints', () => {
    const { getByText } = render(<Kbd>⌘K</Kbd>);
    expect(getByText('⌘K')).toBeInTheDocument();
  });
});
