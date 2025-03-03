chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Clickbait Score:", message.score);
});

