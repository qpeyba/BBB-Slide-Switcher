import { MessageType, Message, STORAGE_KEYS } from '../types';

const slideNumberDisplay = document.getElementById('slideNumber') as HTMLDivElement;
const prevButton = document.getElementById('prevButton') as HTMLButtonElement;
const nextButton = document.getElementById('nextButton') as HTMLButtonElement;
const followPresenterToggle = document.getElementById(
  'followPresenterToggle'
) as HTMLInputElement;
const syncButton = document.getElementById('syncButton') as HTMLButtonElement;


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

function initializePopup(): void {
  chrome.storage.local.get([STORAGE_KEYS.FOLLOW_PRESENTER], (result) => {
    const followPresenter = result[STORAGE_KEYS.FOLLOW_PRESENTER] !== false;
    followPresenterToggle.checked = followPresenter;
  });

  updateSlideNumber();
}

document.addEventListener('DOMContentLoaded', initializePopup);
