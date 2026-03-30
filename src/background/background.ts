import { Message, MessageType } from '../types';

function handleMessage(
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean | void {
  if (message.type === MessageType.SLIDE_NUMBER_CHANGED) {
    chrome.storage.local.set({
      lastLiveSlide: message.slideNumber,
    });
  } else if (message.type === MessageType.GET_LAST_SLIDE) {
    chrome.storage.local.get(['lastLiveSlide'], (result) => {
      sendResponse({ slideNumber: result.lastLiveSlide || null });
    });
    return true;
  }
}

chrome.runtime.onMessage.addListener(handleMessage);



