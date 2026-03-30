import { MessageType, Message } from '../types';

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

function handleMessage(
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  switch (message.type) {
    case MessageType.GET_CURRENT_SLIDE: {
      const slideNumber = getCurrentSlideNumber();
      sendResponse({ slideNumber });
      return false;
    }
    case MessageType.NEXT_SLIDE: {
      const slideNumber = changeSlide('next');
      if (slideNumber !== null) {
        chrome.runtime.sendMessage({
          type: MessageType.SLIDE_NUMBER_CHANGED,
          slideNumber,
        });
      }
      sendResponse({ slideNumber });
      return false;
    }
    case MessageType.PREV_SLIDE: {
      const slideNumber = changeSlide('prev');
      if (slideNumber !== null) {
        chrome.runtime.sendMessage({
          type: MessageType.SLIDE_NUMBER_CHANGED,
          slideNumber,
        });
      }
      sendResponse({ slideNumber });
      return false;
    }
    default:
      return false;
  }
}

let debounceTimer: number;

function setupObserver(): void {
  const img = getSlideImage();
  if (!img) return;

  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      const slideNumber = getCurrentSlideNumber();
      if (slideNumber !== null) {
        chrome.runtime.sendMessage({
          type: MessageType.SLIDE_NUMBER_CHANGED,
          slideNumber,
        });
      }
    }, 200); // debounce time in ms
  });

  // watch only src changes
  observer.observe(img, {
    attributes: true,
    attributeFilter: ['src'],
  });
}

chrome.runtime.onMessage.addListener(handleMessage);
setupObserver();

export { getSlideImage, getCurrentSlideNumber, changeSlide };

