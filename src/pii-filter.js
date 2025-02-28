const nlp = require('compromise');

// PII Categories we want to detect
const PII_CATEGORIES = {
    PERSON: 'Person',
    ORGANIZATION: 'Organization',
    PLACE: 'Place',
    DATE: 'Date',
    EMAIL: 'Email',
    PHONE: 'Phone',
    CREDIT_CARD: 'CreditCard',
    SSN: 'SSN',
    MONEY: 'Money',
    BANK_ACCOUNT: 'BankAccount',
    IP_ADDRESS: 'IPAddress',
    URL: 'URL',
    PASSPORT: 'Passport',
    LICENSE: 'License'
};

// Some basic regex patterns for things NLP might miss
const BASIC_PATTERNS = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b(?:\+?1[-.]?)?\s*\(?([0-9]{3})\)?[-.\s]*([0-9]{3})[-.\s]*([0-9]{4})\b/g,
    ssn: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b|\b\d{13,16}\b/g,
    money: /(?:[\$\€\£\¥]|USD|EUR|GBP|JPY|AUD|CAD|CHF|CNY|INR|rs)\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:[\$\€\£\¥]|USD|EUR|GBP|JPY|AUD|CAD|CHF|CNY|INR|rs)\b/g,
    bankAccount: /\b(?!0{8,17})[1-9]\d{7,16}\b/g,
    ipAddress: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    url: /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
    passport: /\b(?:[A-Z]{1,2}[0-9]{6,7}|[0-9]{9})\b/g,  // Common passport formats
    license: /\b[A-Z][0-9]{7}\b/g  // Basic pattern for license numbers
};

// Counter for each type of PII
let piiCounters = {};
// Store the latest replacements mapping
let currentReplacements = new Map();
// Store the reverse mapping (placeholder to original)
let reverseMappings = new Map();

// Function to get the next placeholder for a type
function getNextPlaceholder(type) {
    piiCounters[type] = (piiCounters[type] || 0) + 1;
    return `[PII_${type}_${piiCounters[type]}]`;
}

// Function to reset counters and replacements
function resetCounters() {
    piiCounters = {};
    currentReplacements.clear();
    reverseMappings.clear();
}

// Function to get the instruction prompt
function getInstructionPrompt() {
    if (currentReplacements.size === 0) return '';

    const placeholders = Array.from(currentReplacements.values()).join(', ');
    return `\n\nIMPORTANT: This prompt contains masked PII placeholders (${placeholders}). Please maintain these exact placeholders in your response and do not attempt to replace or modify them. Treat them as specific identifiers that must remain unchanged.`;
}

// Function to get the current replacements mapping
function getReplacements() {
    return Object.fromEntries(currentReplacements);
}

// Function to update both forward and reverse mappings
function updateMappings(original, placeholder) {
    currentReplacements.set(original, placeholder);
    reverseMappings.set(placeholder, original);
}

// Function to restore original values from placeholders
function restoreFromPlaceholders(text) {
    if (!text || reverseMappings.size === 0) {
        return text;
    }

    console.log('Starting placeholder restoration for text:', text);
    console.log('Available reverse mappings:', Array.from(reverseMappings.entries()));

    let restoredText = text;
    
    // Updated pattern to match PII_ prefixed placeholders
    const placeholderPattern = /\[PII_[A-Z_]+_\d+\]/g;
    const matches = text.match(placeholderPattern);
    
    if (!matches) {
        console.log('No PII placeholders found in text');
        return text;
    }

    console.log('Found PII placeholders:', matches);

    // Sort placeholders by length (longest first) to avoid partial replacements
    matches.sort((a, b) => b.length - a.length);

    // Replace each placeholder with its original value
    matches.forEach(placeholder => {
        if (reverseMappings.has(placeholder)) {
            const original = reverseMappings.get(placeholder);
            console.log(`Replacing "${placeholder}" with "${original}"`);
            // Use a more specific regex to ensure we match the exact placeholder
            const exactPlaceholderPattern = new RegExp(escapeRegExp(placeholder), 'g');
            restoredText = restoredText.replace(exactPlaceholderPattern, original);
        } else {
            console.log(`Warning: No mapping found for placeholder "${placeholder}"`);
        }
    });

    // Verify no placeholders are left
    const remainingPlaceholders = restoredText.match(placeholderPattern);
    if (remainingPlaceholders) {
        console.warn('Remaining PII placeholders after restoration:', remainingPlaceholders);
    } else {
        console.log('All PII placeholders successfully replaced');
    }

    return restoredText;
}

// Helper function to escape special characters in regex
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Function to detect and mask PII using NLP
function maskPII(text) {
    // Skip empty text
    if (!text || text.trim().length === 0) {
        return text;
    }

    // Don't reset mappings, just reset counters
    piiCounters = {};
    
    let maskedText = text;
    
    try {
        // Use compromise NLP
        const doc = nlp(text);
        
        // Find and mask people names
        const people = doc.match('#Person+');
        if (people.length > 0) {
            people.forEach(match => {
                const original = match.text();
                if (!currentReplacements.has(original)) {
                    const placeholder = getNextPlaceholder('PERSON');
                    updateMappings(original, placeholder);
                }
                maskedText = maskedText.replace(original, currentReplacements.get(original));
            });
        }
        
        // Find and mask organizations
        const orgs = doc.match('#Organization+');
        if (orgs.length > 0) {
            orgs.forEach(match => {
                const original = match.text();
                if (!currentReplacements.has(original)) {
                    const placeholder = getNextPlaceholder('ORG');
                    updateMappings(original, placeholder);
                }
                maskedText = maskedText.replace(original, currentReplacements.get(original));
            });
        }
        
        // Find and mask places
        const places = doc.match('#Place+');
        if (places.length > 0) {
            places.forEach(match => {
                const original = match.text();
                if (!currentReplacements.has(original)) {
                    const placeholder = getNextPlaceholder('LOCATION');
                    updateMappings(original, placeholder);
                }
                maskedText = maskedText.replace(original, currentReplacements.get(original));
            });
        }
        
        // Find and mask dates
        const dates = doc.match('#Date+');
        if (dates.length > 0) {
            dates.forEach(match => {
                const original = match.text();
                if (!currentReplacements.has(original)) {
                    const placeholder = getNextPlaceholder('DATE');
                    updateMappings(original, placeholder);
                }
                maskedText = maskedText.replace(original, currentReplacements.get(original));
            });
        }

        // Find and mask money values
        const money = doc.match('#Money+');
        if (money.length > 0) {
            money.forEach(match => {
                const original = match.text();
                if (!currentReplacements.has(original)) {
                    const placeholder = getNextPlaceholder('MONEY');
                    updateMappings(original, placeholder);
                }
                maskedText = maskedText.replace(original, currentReplacements.get(original));
            });
        }
    } catch (error) {
        console.error('Error in NLP processing:', error);
    }
    
    // Use regex for specific patterns that NLP might miss
    for (const [type, pattern] of Object.entries(BASIC_PATTERNS)) {
        const matches = [...text.matchAll(pattern)];
        matches.forEach(match => {
            const original = match[0];
            if (!currentReplacements.has(original)) {
                // Convert type to uppercase for consistency
                const piiType = type.toUpperCase();
                const placeholder = getNextPlaceholder(piiType);
                updateMappings(original, placeholder);
            }
            maskedText = maskedText.replace(original, currentReplacements.get(original));
        });
    }
    
    // Log the mappings for debugging
    if (currentReplacements.size > 0) {
        console.log('Current PII Mappings:', {
            forward: Object.fromEntries(currentReplacements),
            reverse: Object.fromEntries(reverseMappings)
        });
    }
    
    return maskedText;
}

// Function to check if text contains PII
function containsPII(text) {
    // Skip empty text
    if (!text || text.trim().length === 0) {
        return false;
    }

    try {
        // Use compromise NLP to check for entities
        const doc = nlp(text);
        
        // Check for named entities
        if (doc.match('#Person').length > 0) return true;
        if (doc.match('#Organization').length > 0) return true;
        if (doc.match('#Place').length > 0) return true;
        if (doc.match('#Date').length > 0) return true;
        if (doc.match('#Money').length > 0) return true;
        
        // Check basic patterns
        for (const pattern of Object.values(BASIC_PATTERNS)) {
            if (pattern.test(text)) {
                return true;
            }
        }
    } catch (error) {
        console.error('Error in PII detection:', error);
        // If NLP fails, fall back to basic pattern matching
        for (const pattern of Object.values(BASIC_PATTERNS)) {
            if (pattern.test(text)) {
                return true;
            }
        }
    }
    
    return false;
}

// Add custom terms to improve detection
try {
    nlp.extend((Doc, world) => {
        world.addWords({
            'inc': 'Organization',
            'corp': 'Organization',
            'llc': 'Organization',
            'ltd': 'Organization'
        });
    });
} catch (error) {
    console.error('Error extending NLP:', error);
}

// Function to get the reverse mappings
function getReverseMappings() {
    return Object.fromEntries(reverseMappings);
}

// Function to set the mappings from stored data
function setMappings(storedMappings) {
    if (storedMappings.forward) {
        currentReplacements = new Map(Object.entries(storedMappings.forward));
    }
    if (storedMappings.reverse) {
        reverseMappings = new Map(Object.entries(storedMappings.reverse));
    }
    console.log('Set mappings - Forward:', currentReplacements);
    console.log('Set mappings - Reverse:', reverseMappings);
}

// Export functions for use in content script
module.exports = {
    maskPII,
    containsPII,
    getReplacements,
    getReverseMappings,
    setMappings,
    getInstructionPrompt,
    restoreFromPlaceholders
}; 