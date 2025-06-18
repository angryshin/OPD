const assert = require('assert');
const { extractSoapSections } = require('./extractSoapSections.js');

function testExtraction() {
    const sampleResponse = `S (Subjective):
\`\`\`
- Headache for 3 days
\`\`\`

P (Plan):
\`\`\`
- Prescribe pain medication
\`\`\`
`;

    const result = extractSoapSections(sampleResponse);
    assert.strictEqual(result.subjective, '- Headache for 3 days');
    assert.strictEqual(result.plan, '- Prescribe pain medication');
}

function testMissingSections() {
    const result = extractSoapSections('No sections here');
    assert.strictEqual(result.subjective, null);
    assert.strictEqual(result.plan, null);
}

try {
    testExtraction();
    testMissingSections();
    console.log('All tests passed.');
} catch (err) {
    console.error('Test failed:', err.message);
    process.exit(1);
}
