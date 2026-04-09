import { MessageType, Message, STORAGE_KEYS } from '../types';

const slideNumberDisplay = document.getElementById('slideNumber') as HTMLDivElement;
const prevButton = document.getElementById('prevButton') as HTMLButtonElement;
const nextButton = document.getElementById('nextButton') as HTMLButtonElement;
const followPresenterToggle = document.getElementById(
  'followPresenterToggle'
) as HTMLInputElement;
const syncButton = document.getElementById('syncButton') as HTMLButtonElement;

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[STORAGE_KEYS.LAST_LIVE_SLIDE]) {
    handleSlideNumberChanged({ type: MessageType.SLIDE_NUMBER_CHANGED } as Message);
  }
});

async function updateSlideNumber(): Promise<number | null> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) {
      slideNumberDisplay.textContent = '-';
      return null;
    }

    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      type: MessageType.GET_CURRENT_SLIDE,
    } as Message);

    const slideNumber = response?.slideNumber || null;
    slideNumberDisplay.textContent = slideNumber !== null ? String(slideNumber) : '-';
    return slideNumber;
  } catch (error) {
    slideNumberDisplay.textContent = '-';
    console.error('Failed to get current slide:', error);
    return null;
  }
}

async function handlePrevSlide(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) return;

    await chrome.tabs.sendMessage(tabs[0].id, {
      type: MessageType.PREV_SLIDE,
    } as Message);

    await updateSlideNumber();
  } catch (error) {
    console.error('Failed to navigate to previous slide:', error);
  }
}

async function handleNextSlide(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) return;

    await chrome.tabs.sendMessage(tabs[0].id, {
      type: MessageType.NEXT_SLIDE,
    } as Message);

    await updateSlideNumber();
  } catch (error) {
    console.error('Failed to navigate to next slide:', error);
  }
}

async function handleSyncToLive(): Promise<void> {
  try {
    const lastLiveSlide = await new Promise<number | null>((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: MessageType.GET_LAST_SLIDE,
        } as Message,
        (response) => {
          resolve(response?.slideNumber || null);
        }
      );
    });

    if (lastLiveSlide === null) {
      alert('No presenter slide history available');
      return;
    }

    const currentSlide = await updateSlideNumber();
    if (currentSlide === null) {
      alert('Unable to retrieve current slide');
      return;
    }

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) return;

    const diff = lastLiveSlide - currentSlide;
    const messageType = diff > 0 ? MessageType.NEXT_SLIDE : MessageType.PREV_SLIDE;
    const steps = Math.abs(diff);

    for (let i = 0; i < steps; i++) {
      await chrome.tabs.sendMessage(tabs[0].id, {
        type: messageType,
      } as Message);
    }

    await updateSlideNumber();
  } catch (error) {
    console.error('Failed to sync to live slide:', error);
  }
}

async function toggleFollowPresenter(): Promise<void> {
  const isChecked = followPresenterToggle.checked;

  chrome.storage.local.set({
    [STORAGE_KEYS.FOLLOW_PRESENTER]: isChecked,
  });

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]?.id) return;

  try {
    await chrome.tabs.sendMessage(tabs[0].id, {
      type: MessageType.SET_FOLLOW_PRESENTER,
      followPresenter: isChecked,
    } as Message);
  } catch (error) {
    console.error('Failed to update content script:', error);
  }
}

function handleSlideNumberChanged(message: Message): void {
  if (message.type === MessageType.SLIDE_NUMBER_CHANGED) {
    if (followPresenterToggle.checked) {
      updateSlideNumber();
    }
  }
}

function initializePopup(): void {
  chrome.storage.local.get([STORAGE_KEYS.FOLLOW_PRESENTER], (result) => {
    const followPresenter = result[STORAGE_KEYS.FOLLOW_PRESENTER] !== false;
    followPresenterToggle.checked = followPresenter;
  });

  updateSlideNumber().then((slideNumber) => {
    if (slideNumber !== null) {
      chrome.storage.local.get([STORAGE_KEYS.LAST_LIVE_SLIDE], (result) => {
        if (!result[STORAGE_KEYS.LAST_LIVE_SLIDE]) {
          chrome.storage.local.set({
            [STORAGE_KEYS.LAST_LIVE_SLIDE]: slideNumber,
          });
        }
      });
    }
  });

  prevButton.addEventListener('click', handlePrevSlide);
  nextButton.addEventListener('click', handleNextSlide);
  syncButton.addEventListener('click', handleSyncToLive);
  followPresenterToggle.addEventListener('change', toggleFollowPresenter);

  chrome.runtime.onMessage.addListener(handleSlideNumberChanged);
}

document.addEventListener('DOMContentLoaded', initializePopup);
