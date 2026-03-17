import { MessageType, Message, SlideInfo } from '../types';

const SLIDE_SELECTORS = [
  '#slide-background-shape_image',
  'img[alt="tl_image_asset"]',
  'img[src*="/svg/"]',
];

function getSlideImage(): HTMLImageElement | null {
  for (const selector of SLIDE_SELECTORS) {
    const element = document.querySelector(selector);
    if (element instanceof HTMLImageElement) {
      return element;
    }
  }
  return null;
}

function getCurrentSlideNumber(): number | null {
  const img = getSlideImage();
  if (!img) return null;

  const match = img.src.match(/\/svg\/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

function changeSlide(direction: 'next' | 'prev'): number | null {
  const img = getSlideImage();
  if (!img) return null;

  const currentSlide = getCurrentSlideNumber();
  if (currentSlide === null) return null;

  const newSlide = direction === 'next' ? currentSlide + 1 : currentSlide - 1;
  if (newSlide < 1) return null;

  // Replace /svg/N with /svg/(N±1) in the image src
  const newSrc = img.src.replace(/\/svg\/\d+$/, `/svg/${newSlide}`);
  img.src = newSrc;

  return newSlide;
}

export { getSlideImage, getCurrentSlideNumber, changeSlide };

