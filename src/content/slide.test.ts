import { describe, expect, it } from 'vitest';
import {
  findSlideImage,
  getCurrentVisibleSlide,
  getSlideNumberFromUrl,
  selectVisibleSlideImage,
  setVisibleSlide,
  setSlideImageNumber,
  SlideImageLike,
} from './slide';

function slideImage(src: string, width: number, height: number): SlideImageLike {
  return {
    src,
    getBoundingClientRect: () => ({ width, height }),
  };
}

describe('slide helpers', () => {
  it('parses a plain slide url', () => {
    expect(getSlideNumberFromUrl('https://bbb.local/presentation/svg/12')).toBe(12);
  });

  it('parses a slide url with query params', () => {
    expect(getSlideNumberFromUrl('https://bbb.local/presentation/svg/12?foo=bar')).toBe(12);
  });

  it('rejects a non-slide url', () => {
    expect(getSlideNumberFromUrl('https://bbb.local/presentation/png/12')).toBeNull();
  });

  it('selects the visible slide image', () => {
    const hidden = slideImage('https://bbb.local/presentation/svg/4', 0, 0);
    const visible = slideImage('https://bbb.local/presentation/svg/5', 800, 600);

    expect(selectVisibleSlideImage([hidden, visible])).toBe(visible);
  });

  it('selects the largest visible slide image', () => {
    const smaller = slideImage('https://bbb.local/presentation/svg/4', 400, 300);
    const larger = slideImage('https://bbb.local/presentation/svg/5', 800, 600);

    expect(selectVisibleSlideImage([smaller, larger])).toBe(larger);
  });

  it('changes slide image src', () => {
    const image = slideImage('https://bbb.local/presentation/svg/4?foo=bar', 800, 600);

    expect(setSlideImageNumber(image, 9)).toBe(9);
    expect(image.src).toBe('https://bbb.local/presentation/svg/9?foo=bar');
  });

  it('finds the current visible slide from DOM', () => {
    const root = document.createElement('div');
    const hidden = document.createElement('img');
    const visible = document.createElement('img');

    hidden.src = 'https://bbb.local/presentation/svg/4';
    visible.src = 'https://bbb.local/presentation/svg/7';
    hidden.getBoundingClientRect = () => ({ width: 0, height: 0 } as DOMRect);
    visible.getBoundingClientRect = () => ({ width: 800, height: 600 } as DOMRect);
    root.append(hidden, visible);

    expect(findSlideImage(root)).toBe(visible);
    expect(getCurrentVisibleSlide(root)?.slideNumber).toBe(7);
  });

  it('sets the current visible slide in DOM', () => {
    const root = document.createElement('div');
    const image = document.createElement('img');

    image.src = 'https://bbb.local/presentation/svg/4?foo=bar';
    image.getBoundingClientRect = () => ({ width: 800, height: 600 } as DOMRect);
    root.append(image);

    expect(setVisibleSlide(8, root)).toBe(8);
    expect(image.src).toBe('https://bbb.local/presentation/svg/8?foo=bar');
  });
});
