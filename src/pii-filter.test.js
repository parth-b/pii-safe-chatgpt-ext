const { maskPII, containsPII } = require('./pii-filter');

// Test data with various types of PII
const testCases = [
    {
        name: 'Credit Card Test',
        input: 'My credit card number is 300-305-5678-9012',
        expectedType: 'CREDITCARD'
    },
    {
        name: 'Multiple Credit Cards Test',
        input: 'First card: 4532-1234-5678-9012, Second card: 4111 1111 1111 1111, third: 898998989891111',
        expectedType: 'CREDITCARD'
    },
    {
        name: 'Money Test - Multiple Currencies',
        input: `Financial Report:
                USD Amount: $1,234.56
                EUR Amount: €500.00
                GBP Amount: £2,345.67
                JPY Amount: ¥10000
                Amount in AUD: 789.99 AUD
                CNY Payment: 2000.00 CNY
                Swiss Francs: 1,234.56 CHF
                Indian Rupees: 50,000 INR`,
        expectedType: 'MONEY'
    },
    {
        name: 'Money Test - Mixed Formats',
        input: `Payment Summary:
                Amount Due: $1,234.56
                Paid: 1,234.56 USD
                Balance: USD 1,234.56`,
        expectedType: 'MONEY'
    },
    {
        name: 'Bank Account Test',
        input: 'Account number: 12345678901234567',
        expectedType: 'BANKACCOUNT'
    },
    {
        name: 'IP Address Test',
        input: 'Server IP: 192.168.1.1',
        expectedType: 'IPADDRESS'
    },
    {
        name: 'URL Test',
        input: 'Visit our website at https://www.example.com/secure/login',
        expectedType: 'URL'
    },
    {
        name: 'Passport Test',
        input: 'Passport number: AB1234567',
        expectedType: 'PASSPORT'
    },
    {
        name: 'License Test',
        input: 'Driver license: A1234567',
        expectedType: 'LICENSE'
    },
    {
        name: 'Mixed PII Test',
        input: `Customer Details:
                Name: John Smith
                Email: john.smith@email.com
                CC: 4532-1234-5678-9012
                Bank: 123456789012
                USD Amount: $5,000.00
                EUR Payment: €1,234.56
                JPY Balance: ¥50000
                IP: 192.168.1.1
                the revenue was 50crore
                Phone: (555) 123-4567`,
        expectedTypes: ['PERSON', 'EMAIL', 'CREDITCARD', 'BANKACCOUNT', 'MONEY', 'IPADDRESS', 'PHONE']
    },
    {
        name: 'No PII Test',
        input: 'This is a regular text without any personal information.',
        expectedPII: false
    }
];

// Run tests
console.log('Starting PII Detection Tests...\n');

testCases.forEach(testCase => {
    console.log(`Running Test: ${testCase.name}`);
    console.log('Input:', testCase.input);
    
    // Test if PII is detected
    const hasPII = containsPII(testCase.input);
    console.log('PII Detected:', hasPII);
    
    if (hasPII) {
        // Test masking
        const maskedText = maskPII(testCase.input);
        console.log('Masked Output:', maskedText);
        
        // Verify masking
        if (testCase.expectedType) {
            const pattern = new RegExp(`\\[PII_${testCase.expectedType}_\\d+\\]`);
            const hasExpectedMask = pattern.test(maskedText);
            console.log(`Contains expected ${testCase.expectedType} mask:`, hasExpectedMask);
        }
        
        if (testCase.expectedTypes) {
            testCase.expectedTypes.forEach(type => {
                const pattern = new RegExp(`\\[PII_${type}_\\d+\\]`);
                const hasExpectedMask = pattern.test(maskedText);
                console.log(`Contains expected ${type} mask:`, hasExpectedMask);
            });
        }
        
        // Verify original text is not present
        const originalTextPresent = maskedText.includes(testCase.input);
        console.log('Original text completely masked:', !originalTextPresent);
    } else {
        if (testCase.expectedPII === false) {
            console.log('Test passed: No PII detected as expected');
        } else {
            console.log('Test failed: PII should have been detected');
        }
    }
    
    console.log('\n-------------------\n');
}); 