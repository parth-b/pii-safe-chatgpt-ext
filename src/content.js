const { 
    maskPII, 
    containsPII, 
    getReplacements, 
    getReverseMappings,
    setMappings,
    getInstructionPrompt, 
    restoreFromPlaceholders 
} = require('./pii-filter');

// Add this variable to track when a new prompt is submitted
let lastPromptSubmitTime = 0;

// Function to get the prompt from the textarea
function getPrompt() {
    // Try different selector approaches
    const promptDiv = document.querySelector('#prompt-textarea.ProseMirror') || 
                     document.querySelector('[contenteditable="true"].ProseMirror') ||
                     document.querySelector('div[id="prompt-textarea"]');
    
    if (promptDiv) {
        // Get all text content, including nested p tags
        return promptDiv.textContent.trim();
    }
    return null;
}

// Function to set the prompt text
function setPrompt(text, shouldAppendInstructions = true) {
    const promptDiv = document.querySelector('#prompt-textarea.ProseMirror') || 
                     document.querySelector('[contenteditable="true"].ProseMirror') ||
                     document.querySelector('div[id="prompt-textarea"]');
    
    if (promptDiv) {
        // Get instruction prompt if needed
        const instructions = shouldAppendInstructions ? getInstructionPrompt() : '';
        const finalText = text + instructions;

        // Create a new paragraph element with the masked text
        const p = document.createElement('p');
        p.textContent = finalText;
        
        // Clear existing content and add the new paragraph
        promptDiv.innerHTML = '';
        promptDiv.appendChild(p);
        
        // Store both forward and reverse mappings
        const mappings = {
            forward: getReplacements(),
            reverse: getReverseMappings()
        };
        
        if (Object.keys(mappings.forward).length > 0) {
            promptDiv.dataset.piiMappings = JSON.stringify(mappings);
            console.log('Stored PII mappings:', mappings);
        }
        
        // Dispatch an input event to ensure ChatGPT recognizes the change
        promptDiv.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

// Function to process ChatGPT's response
function processChatGPTResponse(responseElement) {
    if (!responseElement) return;

    // Only process responses that came after our last prompt submission
    const responseTime = Date.now();
    if (responseTime < lastPromptSubmitTime) {
        console.log('Skipping old response from before prompt submission');
        return;
    }

    // Check if response is still being generated
    const isGenerating = document.querySelector('.result-streaming');
    if (isGenerating) {
        console.log('Response still generating, waiting...');
        return;
    }

    // Check if we've already processed this response
    if (responseElement.dataset.piiProcessed === 'true') {
        return;
    }

    // Get the stored mappings from the prompt textarea
    const promptDiv = document.querySelector('#prompt-textarea.ProseMirror') || 
                     document.querySelector('[contenteditable="true"].ProseMirror') ||
                     document.querySelector('div[id="prompt-textarea"]');
    
    if (!promptDiv || !promptDiv.dataset.piiMappings) {
        console.log('No PII mappings found for this response');
        return;
    }

    try {
        // Restore the mappings from the stored data
        const storedMappings = JSON.parse(promptDiv.dataset.piiMappings);
        console.log('Retrieved stored mappings:', storedMappings);
        
        // Set both forward and reverse mappings using the new function
        setMappings(storedMappings);

        // First, check if the response contains any PII placeholders
        const responseText = responseElement.textContent;
        const piiPattern = /\[PII_[A-Z_]+_\d+\]/;
        
        if (!piiPattern.test(responseText)) {
            console.log('No PII placeholders found in response:', responseText);
            responseElement.dataset.piiProcessed = 'true';
            return;
        }

        console.log('Found PII placeholders in response, processing...');

        // Process all text nodes within the response element
        const walker = document.createTreeWalker(
            responseElement,
            NodeFilter.SHOW_TEXT,
            null, // Remove the filter to process all text nodes
            false
        );

        let node;
        let hasChanges = false;
        while (node = walker.nextNode()) {
            const originalText = node.textContent;
            if (piiPattern.test(originalText)) {
                const restoredText = restoreFromPlaceholders(originalText);
                if (restoredText !== originalText) {
                    node.textContent = restoredText;
                    hasChanges = true;
                    console.log('Replaced PII placeholders in node:', {
                        original: originalText,
                        restored: restoredText
                    });
                }
            }
        }

        if (hasChanges) {
            // Mark as processed to avoid reprocessing
            responseElement.dataset.piiProcessed = 'true';
            console.log('Successfully restored response with formatting preserved');
        } else {
            console.log('No changes made to response');
        }
    } catch (error) {
        console.error('Error processing ChatGPT response:', error);
    }
}

// Function to monitor for changes in the prompt
function setupPromptMonitoring() {
    console.log('Setting up prompt monitoring...');
    
    // Function to find and observe the prompt element
    function findAndObservePrompt() {
        const promptDiv = document.querySelector('#prompt-textarea.ProseMirror') || 
                         document.querySelector('[contenteditable="true"].ProseMirror') ||
                         document.querySelector('div[id="prompt-textarea"]');
        
        if (promptDiv) {
            console.log('Found prompt element:', promptDiv);
            
            let typingTimer; // Timer identifier for debouncing
            const doneTypingInterval = 1000; // Time in ms (1 second)
            
            // Use MutationObserver to detect changes in the content
            const promptObserver = new MutationObserver((mutations) => {
                const promptText = getPrompt();
                if (promptText) {
                    // Clear the timeout if it has already been set
                    clearTimeout(typingTimer);
                    
                    // Set a new timeout to run after user stops typing
                    typingTimer = setTimeout(() => {
                        // Check if text contains PII
                        if (containsPII(promptText)) {
                            // Get masked version of the text
                            const maskedText = maskPII(promptText);
                            console.log('Found PII - Original:', promptText);
                            console.log('Masked version:', maskedText);
                            
                            // Only update if the text actually changed
                            if (maskedText !== promptText) {
                                setPrompt(maskedText, true);
                            }
                        }
                    }, doneTypingInterval);
                }
            });

            // Start observing the prompt div for changes
            promptObserver.observe(promptDiv, {
                childList: true,
                characterData: true,
                subtree: true
            });
            
            // Add event listener for the submit button
            const submitButton = document.querySelector('button[data-testid="send-button"]');
            if (submitButton) {
                submitButton.addEventListener('click', () => {
                    // Clear any pending debounce timer
                    clearTimeout(typingTimer);
                    // Process immediately on submit
                    const promptText = getPrompt();
                    if (promptText && containsPII(promptText)) {
                        const maskedText = maskPII(promptText);
                        if (maskedText !== promptText) {
                            setPrompt(maskedText, true);
                        }
                    }
                    console.log('Prompt submitted - updating lastPromptSubmitTime');
                    lastPromptSubmitTime = Date.now();
                });
            }
            
            console.log('Observer attached to prompt element');
        } else {
            console.log('Prompt element not found, will retry...');
        }
    }

    // Try immediately
    findAndObservePrompt();

    // Also set up a retry mechanism
    const retryInterval = setInterval(() => {
        const promptExists = document.querySelector('#prompt-textarea.ProseMirror') || 
                           document.querySelector('[contenteditable="true"].ProseMirror') ||
                           document.querySelector('div[id="prompt-textarea"]');
        
        if (promptExists) {
            findAndObservePrompt();
            clearInterval(retryInterval);
            console.log('Successfully set up prompt monitoring');
        }
    }, 1000); // Check every second

    // Clear interval after 10 seconds to prevent infinite checking
    setTimeout(() => clearInterval(retryInterval), 10000);
}

// Monitor for ChatGPT responses
function setupResponseMonitoring() {
    let processingTimeout;

    const observer = new MutationObserver((mutations) => {
        // Clear any existing timeout
        if (processingTimeout) {
            clearTimeout(processingTimeout);
        }

        // Set a new timeout to process the response
        processingTimeout = setTimeout(() => {
            const isGenerating = document.querySelector('.result-streaming');
            if (!isGenerating) {
                const responseElements = document.querySelectorAll('.markdown.prose:not([data-pii-processed="true"])');
                responseElements.forEach(processChatGPTResponse);
            }
        }, 500); // Wait for 500ms after the last mutation
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });

    // Also set up an interval as a backup
    setInterval(() => {
        const isGenerating = document.querySelector('.result-streaming');
        if (!isGenerating) {
            const responseElements = document.querySelectorAll('.markdown.prose:not([data-pii-processed="true"])');
            if (responseElements.length > 0) {
                console.log('Processing responses via interval check');
                responseElements.forEach(processChatGPTResponse);
            }
        }
    }, 2000); // Check every 2 seconds
}

console.log('Content script loaded');

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - setting up monitoring');
    setupPromptMonitoring();
    setupResponseMonitoring();
});

// Also handle dynamic loading of chat interface
const observer = new MutationObserver((mutations) => {
    const promptExists = document.querySelector('#prompt-textarea.ProseMirror') || 
                        document.querySelector('[contenteditable="true"].ProseMirror') ||
                        document.querySelector('div[id="prompt-textarea"]');
    
    if (!promptExists) {
        console.log('Chat interface changed - reinitializing monitoring');
        setupPromptMonitoring();
        setupResponseMonitoring();
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
}); 