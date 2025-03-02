# ChatGPT Prompt Reader Extension

A Chrome extension that reads prompts entered in the ChatGPT chat window.

## Features

- Monitors the ChatGPT input field for any text entered
- Identifies any PII data in the prompt, replaces it with placeholders
- When user submits the prompt, the masked prompt is sent to ChatGPT, solving the risk of sharing sensitive data with openai
- The response returned by chatgpt is scanned for the placeholders, so that users can see the actual response without any hassle.


## Installation

1. Clone this repository or download the files
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the directory containing these files

## Usage

1. After installation, navigate to [ChatGPT](https://chat.openai.com)
2. Open the Chrome DevTools (F12 or right-click and select "Inspect")
3. Look at the console tab to see the prompts being logged as you type

## Development

Currently, the extension simply logs the prompts to the console. This is the foundation for building more advanced features in the future.

## Files

- `manifest.json`: Extension configuration
- `content.js`: Content script that reads the prompts
- `README.md`: This documentation file 
